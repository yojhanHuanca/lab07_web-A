/* El token de la API vive en sessionStorage. La cookie HttpOnly protege las páginas EJS. */
(() => {
  const page = document.body.dataset.page;
  const $ = selector => document.querySelector(selector);
  const protectedPage = ['dashboard', 'profile', 'admin'].includes(page);
  let expirationTimer;
  let loggingOut = false;
  let initializing = false;
  const buttonContents = new WeakMap();
  const text = (selector, value) => { const el = $(selector); if (el) el.textContent = value ?? 'Sin completar'; };
  const date = value => value ? new Date(value).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin completar';
  const roleLabel = user => user.roles.includes('admin') ? 'Administrador' : 'Usuario';
  const fullName = user => [user.name, user.lastName].filter(Boolean).join(' ');
  const initials = user => [user.name, user.lastName].filter(Boolean).map(s => s[0]).join('').toUpperCase() || 'N';
  function notice(message, success = false) {
    const box = $('#notice');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('success', success);
    box.hidden = !message;
  }
  async function logout(expired = false) {
    if (loggingOut) return;
    loggingOut = true;
    clearTimeout(expirationTimer);
    sessionStorage.removeItem('token');
    try { await fetch('/api/auth/signOut', { method: 'POST', signal: AbortSignal.timeout(3000) }); } catch { /* Se elimina la sesión local incluso sin conexión. */ }
    location.replace(`/signIn${expired ? '?expired=1' : ''}`);
  }
  function checkExpiration() {
    clearTimeout(expirationTimer);
    try {
      const token = sessionStorage.getItem('token');
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encoded));
      const remaining = payload.exp * 1000 - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) throw Error();
      expirationTimer = setTimeout(checkExpiration, Math.min(remaining, 2147483647));
      return true;
    } catch { logout(true); return false; }
  }
  async function api(url, options = {}) {
    const token = sessionStorage.getItem('token');
    let response;
    try {
      response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    } catch (err) {
      throw Error(err.name === 'TimeoutError' ? 'El servidor tardó demasiado. Vuelve a intentarlo.' : 'No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.');
    }
    if (response.status === 401 && protectedPage) { logout(true); throw Error('La sesión terminó.'); }
    if (response.status === 403 && protectedPage) { location.replace('/403'); throw Error('Acceso denegado.'); }
    let result;
    try { result = await response.json(); }
    catch { throw Error('El servidor no devolvió una respuesta válida. Vuelve a intentarlo.'); }
    if (!response.ok) throw Error(result.message || 'No se pudo completar la solicitud.');
    return result;
  }
  function setBusy(form, busy) {
    const button = form.querySelector('[type=submit]');
    if (busy && !buttonContents.has(button)) buttonContents.set(button, [...button.childNodes].map(node => node.cloneNode(true)));
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    form.setAttribute('aria-busy', String(busy));
    if (busy) button.textContent = 'Un momento…';
    else if (buttonContents.has(button)) { button.replaceChildren(...buttonContents.get(button)); buttonContents.delete(button); }
  }
  function validatePassword(value) {
    return value.length >= 8 && new TextEncoder().encode(value).length <= 72 && /[A-Z]/.test(value) && /\d/.test(value) && /[#$%&*@]/.test(value);
  }
  function avatar(el, user) {
    el.textContent = initials(user);
    if (!user.url_profile) return;
    try { if (!['http:', 'https:'].includes(new URL(user.url_profile).protocol)) return; } catch { return; }
    const image = document.createElement('img');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.src = user.url_profile;
    image.addEventListener('error', () => { el.textContent = initials(user); });
    el.replaceChildren(image);
  }
  function details(container, user, extended = false) {
    const entries = [['Nombre completo', fullName(user)], ['Correo electrónico', user.email], ['Teléfono', user.phoneNumber], ['Fecha de nacimiento', date(user.birthdate)], ['Edad', user.age == null ? 'Sin completar' : `${user.age} años`], ['Dirección', user.address || 'Sin completar']];
    if (extended) entries.push(['Rol', roleLabel(user)], ['Fecha de registro', date(user.createdAt)], ['Última actualización', date(user.updatedAt)], ['URL de foto', user.url_profile || 'Sin completar']);
    container.replaceChildren();
    for (const [label, value] of entries) {
      const item = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value ?? 'Sin completar';
      item.append(dt, dd); container.append(item);
    }
  }
  function showUser(user) {
    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name || 'Hola'; });
    document.querySelectorAll('[data-avatar]').forEach(el => avatar(el, user));
    if (page === 'dashboard') {
      const keys = ['name', 'lastName', 'email', 'phoneNumber', 'birthdate', 'address', 'url_profile'];
      text('#completion', `${Math.round(keys.filter(key => user[key]).length / keys.length * 100)}%`);
      text('#account-role', roleLabel(user)); text('#joined', date(user.createdAt));
      details($('#summary'), user);
    }
    if (page === 'profile') {
      text('#full-name', fullName(user)); text('#profile-email', user.email); text('#profile-role', roleLabel(user));
      text('#profile-age', user.age == null ? 'Sin completar' : `${user.age} años`); text('#profile-joined', date(user.createdAt));
      const form = $('#profile-form');
      for (const key of ['name', 'lastName', 'phoneNumber', 'email', 'address', 'url_profile']) form.elements[key].value = user[key] || '';
      form.elements.birthdate.value = user.birthdate ? user.birthdate.slice(0, 10) : '';
      form.elements.password.value = '';
      form.elements.password.dispatchEvent(new Event('input'));
      updateAge();
    }
  }
  function updateAge() {
    const field = $('#birthdate'); if (!field) return;
    const born = new Date(`${field.value}T00:00:00Z`);
    const today = new Date();
    let age = today.getUTCFullYear() - born.getUTCFullYear();
    if (today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) age--;
    text('#age-hint', Number.isFinite(age) && age >= 0 ? `${age} años` : '');
  }
  document.querySelectorAll('.reveal').forEach(button => button.addEventListener('click', () => {
    const input = button.previousElementSibling; const show = input.type === 'password';
    input.type = show ? 'text' : 'password'; button.textContent = show ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña'); button.setAttribute('aria-pressed', String(show));
  }));
  if ($('#birthdate')) { $('#birthdate').max = new Date().toISOString().slice(0, 10); $('#birthdate').addEventListener('input', updateAge); }
  document.querySelector('.side-nav a.active')?.setAttribute('aria-current', 'page');
  if ($('#password-help')) {
    const password = $('#password');
    const hint = $('#password-help');
    const original = hint.textContent;
    password.addEventListener('input', () => {
      const valid = validatePassword(password.value);
      hint.classList.toggle('password-valid', valid);
      hint.textContent = valid ? '✓ La contraseña cumple los requisitos.' : original;
      password.setCustomValidity(password.value && !valid ? 'Usa 8 caracteres, mayúscula, número y un símbolo # $ % & * @. Máximo 72 bytes.' : '');
    });
  }
  document.querySelectorAll('.logout').forEach(button => button.addEventListener('click', () => logout()));
  if (page === 'signIn' || page === 'signUp') {
    const params = new URLSearchParams(location.search);
    if (params.has('registered')) notice('Tu cuenta está lista. Inicia sesión para entrar.', true);
    if (params.has('expired')) notice('Tu sesión terminó. Vuelve a iniciar sesión.');
    $('#auth-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form));
      if (form.getAttribute('aria-busy') === 'true') return;
      notice('');
      if (page === 'signUp' && !validatePassword(body.password)) return notice('Usa al menos 8 caracteres, una mayúscula, un número y un símbolo # $ % & * @. Máximo 72 bytes.');
      setBusy(form, true);
      try {
        const result = await api(`/api/auth/${page}`, { method: 'POST', body: JSON.stringify(body) });
        if (page === 'signIn') { sessionStorage.setItem('token', result.token); location.replace(result.user.roles.includes('admin') ? '/admin' : '/dashboard'); }
        else location.replace('/signIn?registered=1');
      } catch (err) { notice(err.message); } finally { setBusy(form, false); }
    });
  }
  async function directory() {
    const users = await api('/api/users');
    text('#total-users', users.length); text('#total-admins', users.filter(user => user.roles.includes('admin')).length);
    const now = new Date();
    text('#total-new', users.filter(user => { const joined = new Date(user.createdAt); return joined.getFullYear() === now.getFullYear() && joined.getMonth() === now.getMonth(); }).length);
    const modal = $('#user-modal');
    $('#user-modal .modal-close').onclick = () => modal.close();
    function render() {
      const search = $('#search').value.trim().toLocaleLowerCase('es');
      const filtered = users.filter(user => `${fullName(user)} ${user.email}`.toLocaleLowerCase('es').includes(search));
      text('#result-count', `${filtered.length} de ${users.length} personas`);
      $('#empty-state').hidden = filtered.length > 0;
      $('#users-table').replaceChildren();
      for (const user of filtered) {
        const row = document.createElement('tr'); const personCell = document.createElement('td');
        const person = document.createElement('div'); person.className = 'table-person';
        const face = document.createElement('span'); face.className = 'avatar'; avatar(face, user);
        const info = document.createElement('div'); const name = document.createElement('strong'); name.textContent = fullName(user);
        const email = document.createElement('small'); email.textContent = user.email; info.append(name, email); person.append(face, info); personCell.append(person); row.append(personCell);
        for (const value of [user.phoneNumber || 'Sin completar', roleLabel(user), date(user.createdAt)]) { const td = document.createElement('td'); td.textContent = value; row.append(td); }
        const action = document.createElement('td'); const button = document.createElement('button'); button.className = 'detail-button'; button.textContent = 'Ver perfil ↗'; button.setAttribute('aria-label', `Ver perfil de ${fullName(user)}`);
        button.addEventListener('click', async () => {
          button.disabled = true;
          try { const data = await api(`/api/users/${user.id}`); text('#modal-title', fullName(data)); details($('#user-detail'), data, true); modal.showModal(); $('#user-modal .modal-close').focus(); }
          catch (err) { notice(err.message); } finally { button.disabled = false; }
        });
        action.append(button); row.append(action); $('#users-table').append(row);
      }
    }
    $('#search').oninput = render; render();
  }
  if ($('#profile-form')) $('#profile-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form)); notice('');
    if (form.getAttribute('aria-busy') === 'true') return;
    if (body.password && !validatePassword(body.password)) return notice('La nueva contraseña no cumple los requisitos indicados.');
    setBusy(form, true);
    try { const user = await api('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }); showUser(user); notice('Cambios guardados. Tu perfil está actualizado.', true); text('#save-state', 'Guardado correctamente'); }
    catch (err) { notice(err.message); } finally { setBusy(form, false); }
  });
  async function initialize() {
    if (initializing || !checkExpiration()) return;
    initializing = true;
    notice('');
    $('#loading').hidden = false;
    $('#retry-load').hidden = true;
    try {
      const user = await api('/api/users/me');
      if (!user.roles.some(role => ['user', 'admin'].includes(role)) || (page === 'admin' && !user.roles.includes('admin'))) { location.replace('/403'); return; }
      showUser(user);
      if (page === 'admin') await directory();
      $('#page-content').hidden = false;
    } catch (err) { notice(err.message); if (!loggingOut) $('#retry-load').hidden = false; }
    finally { $('#loading').hidden = true; initializing = false; }
  }
  if (protectedPage) {
    $('#retry-load').addEventListener('click', initialize);
    initialize();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiration(); });
    window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
  }
})();
