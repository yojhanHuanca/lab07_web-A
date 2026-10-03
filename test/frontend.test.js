import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';
import { Window } from 'happy-dom';

const script = await readFile(new URL('../src/public/app.js', import.meta.url), 'utf8');
const token = expiration => `test.${Buffer.from(JSON.stringify({ exp: expiration })).toString('base64url')}.test`;
const user = { id: 'user1', name: 'Lucía', lastName: 'Torres', email: 'lucia@example.test', phoneNumber: '999999999', birthdate: '2000-10-04T00:00:00.000Z', age: 25, address: 'Lima', url_profile: '', roles: ['user'], createdAt: '2026-10-03T00:00:00Z' };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
async function fixture(page, api, storedToken = token(Math.floor(Date.now() / 1000) + 3600)) {
    const window = new Window({ url: `http://localhost:3000/${page}`, settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
    const file = ['signIn', 'signUp'].includes(page) ? 'auth' : 'workspace';
    const html = await ejs.renderFile(fileURLToPath(new URL(`../src/views/${file}.ejs`, import.meta.url)), { page, title: 'Prueba', admin: page === 'admin' });
    window.document.write(html);
    if (storedToken) window.sessionStorage.setItem('token', storedToken);
    window.fetch = api;
    // Simular navegación como cambio de URL, sin realizar solicitudes externas.
    window.location.replace = value => { window.happyDOM.setURL(new URL(value, window.location.href).href); };
    window.eval(script);
    return window;
}
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)); };
test('frontend: login guarda JWT y dirige al panel del rol', async () => {
    for (const role of ['user', 'admin']) {
        let sent;
        const window = await fixture('signIn', async (url, options) => { sent = { url, options }; return response({ token: 'jwt-de-prueba', user: { ...user, roles: [role] } }); }, null);
        try {
            const form = window.document.querySelector('#auth-form');
            form.elements.email.value = user.email; form.elements.password.value = 'Prueba#123';
            form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle();
            assert.equal(sent.url, '/api/auth/signIn'); assert.equal(JSON.parse(sent.options.body).email, user.email);
            assert.equal(window.sessionStorage.getItem('token'), 'jwt-de-prueba');
            assert.equal(window.location.pathname, role === 'admin' ? '/admin' : '/dashboard');
        } finally { await window.happyDOM.abort(); window.close(); }
    }
});
test('frontend: registro valida contraseña y redirige a signIn', async () => {
    let calls = 0;
    const window = await fixture('signUp', async () => { calls++; return response(user, 201); }, null);
    try {
        const form = window.document.querySelector('#auth-form');
        for (const [key, value] of Object.entries({ name: user.name, lastName: user.lastName, phoneNumber: user.phoneNumber, email: user.email, birthdate: '2000-10-04', password: 'débil' })) form.elements[key].value = value;
        form.dispatchEvent(new window.Event('submit', { cancelable: true })); await settle();
        assert.equal(calls, 0); assert.equal(window.document.querySelector('#notice').hidden, false);
        form.elements.password.value = 'Fuerte#123';
        form.dispatchEvent(new window.Event('submit', { cancelable: true })); await settle();
        assert.equal(calls, 1); assert.equal(window.location.pathname, '/signIn'); assert.equal(window.location.search, '?registered=1');
    } finally { await window.happyDOM.abort(); window.close(); }
});
test('frontend: perfil carga, envía Bearer y muestra cambios guardados', async () => {
    let patch;
    const window = await fixture('profile', async (url, options) => {
        if (options.method === 'PATCH') { patch = options; return response({ ...user, name: 'Nuevo nombre' }); }
        return response(user);
    });
    try {
        await settle();
        assert.equal(window.document.querySelector('#page-content').hidden, false);
        const form = window.document.querySelector('#profile-form');
        assert.equal(form.elements.lastName.value, user.lastName);
        form.elements.name.value = 'Nuevo nombre';
        form.dispatchEvent(new window.Event('submit', { cancelable: true })); await settle();
        assert.match(patch.headers.Authorization, /^Bearer /); assert.equal(JSON.parse(patch.body).name, 'Nuevo nombre');
        assert.match(window.document.querySelector('#notice').textContent, /Cambios guardados/);
        assert.equal(form.elements.password.value, '');
        assert.equal(form.querySelector('[type=submit]').getAttribute('aria-busy'), 'false');
        assert.ok(form.querySelector('[type=submit] span'), 'Conserva el icono al terminar de guardar');
    } finally { await window.happyDOM.abort(); window.close(); }
});
test('frontend: búsqueda y detalle admin usan contenido de texto seguro', async () => {
    const maliciousName = '<img src=x onerror=alert(1)>';
    const record = { ...user, name: maliciousName };
    const window = await fixture('admin', async url => response(url === '/api/users/me' ? { ...user, roles: ['admin'] } : url === '/api/users' ? [record] : record));
    try {
        await settle();
        assert.equal(window.document.querySelectorAll('#users-table tr').length, 1);
        assert.equal(window.document.querySelectorAll('#users-table img').length, 0);
        const dialog = window.document.querySelector('#user-modal');
        window.document.querySelector('.detail-button').click(); await settle();
        assert.equal(dialog.open, true); assert.match(window.document.querySelector('#modal-title').textContent, /<img/);
        window.document.querySelector('.modal-close').click(); assert.equal(dialog.open, false);
        const search = window.document.querySelector('#search'); search.value = 'no-existe'; search.dispatchEvent(new window.Event('input'));
        assert.equal(window.document.querySelector('#empty-state').hidden, false);
    } finally { await window.happyDOM.abort(); window.close(); }
});
test('frontend: token vencido y 401 limpian sesión; 403 redirige', async () => {
    for (const scenario of ['expired', '401', '403']) {
        const window = await fixture('dashboard', async url => url === '/api/auth/signOut' ? response({ ok: true }) : response({ message: 'Sin acceso' }, Number(scenario)), scenario === 'expired' ? token(1) : undefined);
        try {
            await settle();
            assert.equal(window.location.pathname, scenario === '403' ? '/403' : '/signIn');
            if (scenario !== '403') assert.equal(window.sessionStorage.getItem('token'), null);
        } finally { await window.happyDOM.abort(); window.close(); }
    }
});
test('frontend: permite reintentar después de un fallo de red', async () => {
    let calls = 0;
    const window = await fixture('dashboard', async () => {
        calls++;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return response(user);
    });
    try {
        await settle();
        assert.equal(window.document.querySelector('#retry-load').hidden, false);
        assert.match(window.document.querySelector('#notice').textContent, /Revisa tu conexión/);
        window.document.querySelector('#retry-load').click(); await settle();
        assert.equal(calls, 2);
        assert.equal(window.document.querySelector('#retry-load').hidden, true);
        assert.equal(window.document.querySelector('#page-content').hidden, false);
    } finally { await window.happyDOM.abort(); window.close(); }
});
test('frontend: un error no JSON se explica sin bloquear el formulario', async () => {
    const window = await fixture('signIn', async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError(); } }), null);
    try {
        const form = window.document.querySelector('#auth-form');
        form.elements.email.value = user.email; form.elements.password.value = 'Prueba#123';
        form.dispatchEvent(new window.Event('submit', { cancelable: true })); await settle();
        assert.match(window.document.querySelector('#notice').textContent, /respuesta válida/);
        assert.equal(form.querySelector('[type=submit]').disabled, false);
        assert.ok(form.querySelector('[type=submit] span'));
    } finally { await window.happyDOM.abort(); window.close(); }
});
