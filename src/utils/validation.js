export const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const passwordValid = value => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value) <= 72 && /[A-Z]/.test(value) && /\d/.test(value) && /[#$%&*@]/.test(value);
export function ageFrom(value, today = new Date()) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    let age = today.getUTCFullYear() - date.getUTCFullYear();
    if (today.getUTCMonth() < date.getUTCMonth() || (today.getUTCMonth() === date.getUTCMonth() && today.getUTCDate() < date.getUTCDate())) age--;
    return age;
}
export function profileInput(body) {
    const values = { name: body.name, lastName: body.lastName, email: body.email, phoneNumber: body.phoneNumber ?? body.phoneNumer, birthdate: body.birthdate, address: body.address ?? body.adress ?? '', url_profile: body.url_profile ?? '' };
    for (const key of ['name', 'lastName', 'email', 'phoneNumber', 'birthdate']) {
        if (typeof values[key] !== 'string' || !values[key].trim()) throw fail(`El campo ${key} es obligatorio.`);
        values[key] = values[key].trim();
    }
    values.email = values.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) throw fail('Introduce un email válido.');
    if (!/^[+\d\s().-]{6,25}$/.test(values.phoneNumber)) throw fail('Introduce un teléfono válido.');
    const date = new Date(values.birthdate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.birthdate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== values.birthdate || date > new Date() || date.getUTCFullYear() < 1900) throw fail('Introduce una fecha de nacimiento válida, no futura.');
    if (typeof values.address !== 'string' || values.address.length > 250 || values.name.length > 80 || values.lastName.length > 100) throw fail('Revisa la longitud de tus datos.');
    if (typeof values.url_profile !== 'string' || values.url_profile.length > 2048) throw fail('URL de foto inválida.');
    if (values.url_profile) {
        try { if (!['http:', 'https:'].includes(new URL(values.url_profile).protocol)) throw Error(); }
        catch { throw fail('La foto debe tener una URL http o https.'); }
    }
    return values;
}
export function publicUser(user) {
    return { id: String(user._id), name: user.name, lastName: user.lastName, email: user.email, phoneNumber: user.phoneNumber ?? user.phoneNumer, birthdate: user.birthdate, age: ageFrom(user.birthdate), address: user.address ?? user.adress ?? '', url_profile: user.url_profile || '', roles: user.roles.map(r => r.name), createdAt: user.createdAt, updatedAt: user.updatedAt };
}
