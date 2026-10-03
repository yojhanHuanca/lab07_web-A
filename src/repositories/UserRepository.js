import User from '../models/User.js';

class UserRepository {
    async create(userData) {
        const user = new User(userData);
        return user.save();
    }

    async findByEmail(email) {
        return User.findOne({ email }).select('+password').populate('roles').exec();
    }

    async findById(id) {
        return User.findById(id).populate('roles').exec();
    }

    async updatePassword(id, password) {
        const user = await User.findById(id);
        if (!user) return null;
        user.password = password;
        return user.save();
    }

    async getAll() {
        return User.find().populate('roles').exec();
    }
}

export default new UserRepository();
