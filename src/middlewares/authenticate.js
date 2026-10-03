import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
export async function identify(token, req) {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!mongoose.isValidObjectId(payload.sub)) throw new Error('Identidad inválida');
    const user = await User.findById(payload.sub).populate('roles');
    if (!user) throw new Error('Usuario inexistente');
    req.userId = String(user._id);
    req.userRoles = user.roles.map(r => r.name);
}
export default async function authenticate(req, res, next) {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ message: 'No autorizado' });
    try { await identify(match[1], req); }
    catch { return res.status(401).json({ message: 'Token no válido o caducado' }); }
    next();
}
export function protectPage(roles = ['user', 'admin']) {
    return async (req, res, next) => {
        const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('page_session='));
        try { await identify(cookie ? decodeURIComponent(cookie.slice(13)) : '', req); }
        catch { res.clearCookie('page_session', { path: '/' }); return res.redirect('/signIn'); }
        if (!req.userRoles.some(role => roles.includes(role))) return res.status(403).render('error', { title: 'Acceso denegado', code: 403 });
        next();
    };
}
