import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { fail, passwordValid, profileInput, publicUser } from '../utils/validation.js';
class AuthService {
    async signUp(body) {
        const data = profileInput(body);
        if (!passwordValid(body.password)) throw fail('La contraseña necesita 8 caracteres, una mayúscula, un dígito y un símbolo # $ % & * @ (máximo 72 bytes).');
        if (await User.exists({ email: data.email })) throw fail('El email ya se encuentra en uso.', 409);
        const role = await Role.findOne({ name: 'user' });
        if (!role) throw fail('No se pudo preparar el registro.', 503);
        const user = await User.create({ ...data, password: body.password, roles: [role._id] });
        await user.populate('roles');
        return publicUser(user);
    }
    async signIn({ email, password }) {
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) throw fail('Introduce email y contraseña.');
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password').populate('roles');
        if (!user || !await bcrypt.compare(password, user.password)) throw fail('Credenciales inválidas.', 401);
        const token = jwt.sign({ roles: user.roles.map(r => r.name) }, process.env.JWT_SECRET, { subject: String(user._id), expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
        return { token, user: publicUser(user) };
    }
}
export default new AuthService();
