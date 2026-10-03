import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Role from '../src/models/Role.js';
import seedRoles from '../src/utils/seedRoles.js';
import seedUsers from '../src/utils/seedUsers.js';
import { ageFrom, passwordValid } from '../src/utils/validation.js';

let mongo, temp, port, adminToken, userToken, userId, adminCookie, userCookie;
const profile = { name: 'Lucía', lastName: 'Torres', email: 'lucia@example.test', phoneNumber: '+51 999999999', birthdate: '2000-10-04', password: 'Prueba#123' };
before(async () => {
    process.env.JWT_SECRET = 'test-only-secret-never-used-in-production';
    process.env.BCRYPT_SALT_ROUNDS = '4';
    Object.assign(process.env, { ADMIN_EMAIL: 'admin@example.test', ADMIN_PASSWORD: 'Admin#12345', ADMIN_PHONE: '999999999', ADMIN_BIRTHDATE: '1990-01-01' });
    temp = await mkdtemp(path.join(tmpdir(), 'nexo-test-'));
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const binary = process.env.MONGOD_BINARY || (process.platform === 'win32' ? 'C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe' : 'mongod');
    mongo = spawn(binary, ['--dbpath', temp, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('MongoDB de pruebas no inició')), 20000);
        mongo.once('error', error => { clearTimeout(timer); reject(error); });
        mongo.once('exit', code => { clearTimeout(timer); reject(Error(`MongoDB terminó: ${code}`)); });
        mongo.stdout.on('data', chunk => { if (chunk.toString().includes('Waiting for connections')) { clearTimeout(timer); resolve(); } });
        mongo.stderr.resume();
    });
    await mongoose.connect(`mongodb://127.0.0.1:${port}/nexo_test`);
    await Promise.all([User.init(), Role.init()]);
    await seedRoles(); await seedUsers();
}, { timeout: 30000 });
after(async () => {
    await mongoose.disconnect();
    if (mongo && mongo.exitCode === null) await new Promise(resolve => { mongo.once('exit', resolve); mongo.kill(); });
    // Solo el directorio temporal creado por esta prueba, nunca la BD del usuario.
    if (temp && path.resolve(temp).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(temp).startsWith('nexo-test-')) await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
test('edad y complejidad de contraseña', () => {
    assert.equal(ageFrom('2000-10-04', new Date('2026-10-03')), 25);
    assert.equal(ageFrom('2000-10-04', new Date('2026-10-04')), 26);
    for (const value of ['corta', 'minusculas#123', 'Mayuscula#', 'SinSimbolo123', 123]) assert.equal(passwordValid(value), false);
    assert.equal(passwordValid(profile.password), true);
});
test('seed de roles y administrador es idempotente y repone roles faltantes', async () => {
    await seedUsers(); assert.equal(await User.countDocuments(), 1);
    await Role.deleteOne({ name: 'user' }); await seedRoles();
    assert.equal(await Role.countDocuments(), 2);
});
test('páginas públicas, estáticos, 404 y redirección sin sesión', async () => {
    for (const page of ['/signIn', '/signUp']) { const res = await request(app).get(page).expect(200); assert.match(res.text, /nexo/); }
    await request(app).get('/assets/styles.css').expect(200);
    await request(app).get('/vendor/materialize/css/materialize.min.css').expect(200);
    await request(app).get('/vendor/materialize/js/materialize.min.js').expect(200);
    for (const page of ['/dashboard', '/profile', '/admin']) await request(app).get(page).expect(302).expect('Location', '/signIn');
    await request(app).get('/inexistente').expect(404);
    await request(app).get('/api/inexistente').expect(404);
});
test('registro valida campos y nunca permite autoasignar admin', async () => {
    for (const changes of [{ lastName: '' }, { password: 'invalida' }, { password: 123 }, { birthdate: '2100-01-01' }, { birthdate: '2000-02-31' }, { email: { $ne: null } }, { phoneNumber: '' }]) await request(app).post('/api/auth/signUp').send({ ...profile, ...changes }).expect(400);
    const res = await request(app).post('/api/auth/signUp').send({ ...profile, roles: ['admin'] }).expect(201);
    userId = res.body.id; assert.deepEqual(res.body.roles, ['user']); assert.equal(res.body.password, undefined);
    const stored = await User.findById(userId).select('+password');
    assert.notEqual(stored.password, profile.password); assert.equal(await bcrypt.compare(profile.password, stored.password), true);
    await request(app).post('/api/auth/signUp').send(profile).expect(409);
});
test('login normaliza email, rechaza credenciales incorrectas y crea cookie HttpOnly', async () => {
    await request(app).post('/api/auth/signIn').send({ email: profile.email, password: 'incorrecta' }).expect(401);
    const user = await request(app).post('/api/auth/signIn').send({ email: ` ${profile.email.toUpperCase()} `, password: profile.password }).expect(200);
    userToken = user.body.token; userCookie = user.headers['set-cookie'][0].split(';')[0];
    assert.match(user.headers['set-cookie'][0], /HttpOnly/); assert.match(user.headers['set-cookie'][0], /SameSite=Strict/);
    const admin = await request(app).post('/api/auth/signIn').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }).expect(200);
    adminToken = admin.body.token; adminCookie = admin.headers['set-cookie'][0].split(';')[0];
});
test('permisos de usuario y administrador se aplican en API y páginas', async () => {
    await request(app).get('/api/users').expect(401);
    await request(app).get('/api/users').set('Authorization', `Bearer ${userToken}`).expect(403);
    await request(app).get('/api/users/me').set('Cookie', userCookie).expect(401);
    await request(app).get('/admin').set('Cookie', userCookie).expect(403);
    for (const page of ['/dashboard', '/profile']) await request(app).get(page).set('Cookie', userCookie).expect(200);
    for (const page of ['/dashboard', '/profile', '/admin']) await request(app).get(page).set('Cookie', adminCookie).expect(200);
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(res.body.length, 2); assert.ok(res.body.every(user => !('password' in user) && user.createdAt));
    await request(app).get(`/api/users/${userId}`).set('Authorization', `Bearer ${userToken}`).expect(403);
    await request(app).get(`/api/users/${userId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).get('/api/users/invalido').set('Authorization', `Bearer ${adminToken}`).expect(404);
});
test('perfil editable con alias, sin escalamiento y contraseña opcional', async () => {
    const update = { ...profile, phoneNumber: undefined, phoneNumer: '987654321', adress: 'Lima', roles: ['admin'], password: '' };
    const result = await request(app).patch('/api/users/me').set('Authorization', `Bearer ${userToken}`).send(update).expect(200);
    assert.equal(result.body.address, 'Lima'); assert.equal(result.body.phoneNumber, '987654321'); assert.deepEqual(result.body.roles, ['user']);
    await request(app).patch('/api/users/me').set('Authorization', `Bearer ${userToken}`).send({ ...profile, url_profile: 'javascript:alert(1)' }).expect(400);
    await request(app).patch('/api/users/me').set('Authorization', `Bearer ${userToken}`).send({ ...profile, email: process.env.ADMIN_EMAIL }).expect(409);
    await request(app).patch('/api/users/me').set('Authorization', `Bearer ${userToken}`).send({ ...profile, password: 'Nueva#12345' }).expect(200);
    await request(app).post('/api/auth/signIn').send({ email: profile.email, password: profile.password }).expect(401);
    await request(app).post('/api/auth/signIn').send({ email: profile.email, password: 'Nueva#12345' }).expect(200);
});
test('tokens expirados, alterados y cambios de rol', async () => {
    const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: -1 });
    for (const token of [expired, `${userToken}x`]) await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(401);
    await request(app).get('/dashboard').set('Cookie', `page_session=${expired}`).expect(302).expect('Location', '/signIn');
    const adminId = jwt.decode(adminToken).sub;
    const role = await Role.findOne({ name: 'user' });
    await User.updateOne({ _id: adminId }, { roles: [role._id] });
    await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`).expect(403);
    await request(app).post('/api/auth/signOut').expect(200).expect(res => assert.match(res.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/));
});
