import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { passwordValid, ageFrom } from '../utils/validation.js';
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { type: String, required: true, select: false },
    phoneNumber: { type: String, required: true, trim: true, alias: 'phoneNumer' },
    birthdate: { type: Date, required: true, validate: { validator: d => Number.isFinite(d?.getTime()) && d <= new Date() && d.getUTCFullYear() >= 1900, message: 'Fecha de nacimiento inválida' } },
    url_profile: { type: String, default: '' },
    address: { type: String, trim: true, default: '', maxlength: 250, alias: 'adress' },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }]
}, { timestamps: true });
// Validar el texto original antes de cifrarlo, nunca el hash almacenado.
UserSchema.pre('validate', function () {
    if (this.isModified('password') && !passwordValid(this.password)) this.invalidate('password', 'Usa al menos 8 caracteres, una mayúscula, un dígito y un símbolo # $ % & * @ (máximo 72 bytes).');
});
UserSchema.pre('save', async function () {
    if (this.isModified('password')) this.password = await bcrypt.hash(this.password, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
});
UserSchema.virtual('age').get(function () { return ageFrom(this.birthdate); });
UserSchema.set('toJSON', { virtuals: true, transform: (_doc, value) => { delete value.password; delete value.__v; return value; } });
export default mongoose.model('User', UserSchema);
