import Role from '../models/Role.js';
export default async function seedRoles() {
    for (const name of ['user', 'admin']) await Role.updateOne({ name }, { $setOnInsert: { name } }, { upsert: true });
}
