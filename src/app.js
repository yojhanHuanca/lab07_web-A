import express from 'express';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import { protectPage } from './middlewares/authenticate.js';
const app = express();
const directory = path => fileURLToPath(new URL(path, import.meta.url));
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', directory('./views/'));
app.use(express.json({ limit: '32kb' }));
app.use('/assets', express.static(directory('./public/')));
app.use('/vendor/materialize', express.static(directory('../node_modules/@materializecss/materialize/dist/')));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/', (req, res) => res.redirect('/signIn'));
for (const page of ['signIn', 'signUp']) app.get(`/${page}`, (req, res) => res.render('auth', { page, title: page === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta' }));
app.get('/dashboard', protectPage(), (req, res) => res.render('workspace', { page: 'dashboard', title: 'Mi espacio', admin: req.userRoles.includes('admin') }));
app.get('/profile', protectPage(), (req, res) => res.render('workspace', { page: 'profile', title: 'Mi cuenta', admin: req.userRoles.includes('admin') }));
app.get('/admin', protectPage(['admin']), (req, res) => res.render('workspace', { page: 'admin', title: 'Usuarios', admin: true }));
app.get('/403', (req, res) => res.status(403).render('error', { title: 'Acceso denegado', code: 403 }));
app.use((req, res) => req.path.startsWith('/api/') ? res.status(404).json({ message: 'Ruta no encontrada' }) : res.status(404).render('error', { title: 'Página no encontrada', code: 404 }));
app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = err.message;
    if (err.code === 11000) { status = 409; message = 'El email ya se encuentra en uso.'; }
    if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map(e => e.message).join(' '); }
    if (status >= 500) { console.error(err); message = 'Error interno del servidor. Inténtalo nuevamente.'; }
    res.status(status).json({ message });
});
export default app;
