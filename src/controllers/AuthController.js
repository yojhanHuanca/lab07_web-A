import authService from '../services/AuthService.js';
import jwt from 'jsonwebtoken';
class AuthController {
    async signUp(req, res, next) {
        try { res.status(201).json(await authService.signUp(req.body)); } catch (err) { next(err); }
    }
    async signIn(req, res, next) {
        try {
            const result = await authService.signIn(req.body);
            // Cookie HttpOnly para navegación HTML; la API siempre exige Bearer.
            res.cookie('page_session', result.token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.max(0, jwt.decode(result.token).exp * 1000 - Date.now()) });
            res.json(result);
        } catch (err) { next(err); }
    }
    signOut(req, res) { res.clearCookie('page_session', { path: '/' }); res.json({ ok: true }); }
}
export default new AuthController();
