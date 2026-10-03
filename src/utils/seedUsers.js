import User from '../models/User.js';
import Role from '../models/Role.js';
import { profileInput, passwordValid } from './validation.js';
export default async function seedUsers() {
    if (await User.exists({ roles: (await Role.findOne({ name: 'admin' }))._id })) return;
    const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_LAST_NAME, ADMIN_PHONE, ADMIN_BIRTHDATE } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD en .env para crear el administrador inicial.');
    if (!passwordValid(ADMIN_PASSWORD)) throw new Error('ADMIN_PASSWORD no cumple los requisitos de contraseña.');
    const data = profileInput({ email: ADMIN_EMAIL, name: ADMIN_NAME || 'Administrador', lastName: ADMIN_LAST_NAME || 'Principal', phoneNumber: ADMIN_PHONE, birthdate: ADMIN_BIRTHDATE });
    if (await User.exists({ email: data.email })) throw new Error('ADMIN_EMAIL ya pertenece a otra cuenta; elige un email distinto.');
    const roles = await Role.find({ name: { $in: ['user', 'admin'] } });
    await User.create({ ...data, password: ADMIN_PASSWORD, roles: roles.map(r => r._id) });
    console.log('Administrador inicial creado.');
}
