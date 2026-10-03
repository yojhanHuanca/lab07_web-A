import express from 'express';
import AuthController from '../controllers/AuthController.js';

const router = express.Router();

router.post('/signUp', AuthController.signUp);
router.post('/signIn', AuthController.signIn);
router.post('/signOut', AuthController.signOut);

export default router;
