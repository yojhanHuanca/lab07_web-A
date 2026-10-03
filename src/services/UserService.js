import User from '../models/User.js';
import mongoose from 'mongoose';
import { fail, profileInput, publicUser, passwordValid } from '../utils/validation.js';
class UserService {
    async getAll() { return (await User.find().populate('roles').sort({ createdAt: -1 })).map(publicUser); }
    async find(id) {
        if (!mongoose.isValidObjectId(id)) throw fail('Usuario no encontrado.', 404);
        const user = await User.findById(id).populate('roles');
        if (!user) throw fail('Usuario no encontrado.', 404);
        return user;
    }
    async getById(id) { return publicUser(await this.find(id)); }
    async update(id, body) {
        const user = await this.find(id);
        const data = profileInput(body);
        if (body.password !== undefined && body.password !== '') {
            if (!passwordValid(body.password)) throw fail('La nueva contraseña no cumple los requisitos.');
            data.password = body.password;
        }
        Object.assign(user, data);
        await user.save();
        return publicUser(user);
    }
}
export default new UserService();
