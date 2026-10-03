export default function authorize(requiredRoles = []) {
    return (req, res, next) => {
        if (!req.userRoles) return res.status(401).json({ message: 'Inautorizado' });
        
        //Si no hay roles requeridos, permitir usuarios autenticados.
        if (requiredRoles.length === 0) return next();

        const hasRole = req.userRoles.some(r => requiredRoles.includes(r));
        if (!hasRole) return res.status(403).json({ message: 'Prohibido: permisos insuficientes' });
        next();
    };
}
