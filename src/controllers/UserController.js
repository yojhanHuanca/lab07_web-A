import userService from '../services/UserService.js';

class UserController {
    async updateMe(req, res, next) {
        try { res.json(await userService.update(req.userId, req.body)); } catch (err) { next(err); }
    }
    async getById(req, res, next) {
        try { res.json(await userService.getById(req.params.id)); } catch (err) { next(err); }
    }

    async getAll(req, res, next) {
        try {
            const users = await userService.getAll();
            res.status(200).json(users);
        } catch (err) {
            next(err);
        }
    }

    async getMe(req, res, next) {
        try {
            const user = await userService.getById(req.userId);
            res.status(200).json(user);
        } catch (err) {
            next(err);
        }
    }
}

export default new UserController();
