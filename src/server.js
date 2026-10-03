import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import seedRoles from './utils/seedRoles.js';
import seedUsers from './utils/seedUsers.js';
async function start() {
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('Configura MONGODB_URI y JWT_SECRET en .env.');
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    if (!Number.isInteger(rounds) || rounds < 4 || rounds > 15) throw new Error('BCRYPT_SALT_ROUNDS debe estar entre 4 y 15.');
    await mongoose.connect(process.env.MONGODB_URI);
    await seedRoles();
    await seedUsers();
    app.listen(process.env.PORT || 3000, () => console.log(`Abre http://localhost:${process.env.PORT || 3000}`));
}
start().catch(err => { console.error('No se pudo iniciar:', err.message); process.exit(1); });
