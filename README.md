# Nexo · Express + EJS + Materialize

Aplicación de cuentas con MongoDB, JWT, perfiles editables y panel de administración.

## Ejecutar

1. `npm install`
2. Completa `.env` usando `.env.example` como referencia, sin sobrescribir tu configuración existente.
3. Inicia MongoDB y configura `MONGODB_URI` y un `JWT_SECRET` aleatorio.
4. Para el primer administrador configura `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PHONE` y `ADMIN_BIRTHDATE`. Escribe la contraseña entre comillas en `.env`, especialmente si contiene `#`. Nombre y apellidos tienen valores predeterminados. La contraseña requiere al menos 8 caracteres, una mayúscula, un dígito y un símbolo de `#$%&*@`; máximo 72 bytes por bcrypt.
5. `npm run dev` y abre http://localhost:3000.

`seedRoles.js` completa ambos roles y `seedUsers.js` crea un administrador con roles user y admin si todavía no existe ninguno. Nunca eleva los permisos de una cuenta existente ni restablece su contraseña. Si faltan datos para crear el primer administrador, el arranque informa qué configurar. En producción usa HTTPS y `NODE_ENV=production` para la cookie Secure.

## Páginas

| Ruta | Acceso |
| --- | --- |
| `/signIn`, `/signUp` | Público |
| `/dashboard`, `/profile` | user o admin |
| `/admin` | admin |
| `/403` | Acceso denegado |
| Cualquier ruta inexistente | 404 |

El registro asigna siempre `user`. El frontend guarda el JWT en `sessionStorage` y lo envía en `Authorization: Bearer ...`. Como las navegaciones HTML no envían sessionStorage, el login también coloca el mismo JWT en una cookie HttpOnly, SameSite=Strict, para proteger las páginas desde Express. Las API privadas aceptan exclusivamente Bearer. Los roles se consultan en MongoDB para que un cambio de permisos tenga efecto en la siguiente petición. El frontend cierra sesión al caducar el token, al volver a una pestaña caducada o recibir un 401; un 403 lleva a la página correspondiente.

## API

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/auth/signUp` | Registro: name, lastName, phoneNumber, birthdate (AAAA-MM-DD), email, password |
| POST | `/api/auth/signIn` | Login: email y password; devuelve token y usuario |
| POST | `/api/auth/signOut` | Borra la cookie de navegación |
| GET | `/api/users/me` | Perfil propio y edad calculada |
| PATCH | `/api/users/me` | Datos completos del formulario; contraseña vacía conserva la actual |
| GET | `/api/users` | Listado sin contraseñas, solo admin |
| GET | `/api/users/:id` | Detalle sin contraseña, solo admin |

Campos canónicos: `phoneNumber` y `address`. Se aceptan `phoneNumer` y `adress` del enunciado como alias de entrada y en el modelo. La edad se calcula, no se almacena. Las contraseñas se validan antes de cifrarse mediante hooks del modelo; no uses actualizaciones directas de MongoDB para cambiarlas. El formulario permite actualizar foto mediante URL http/https, dirección y contraseña; los roles, identificadores y fechas de registro no son editables desde el perfil.

Las cuentas anteriores que no tengan apellidos, teléfono o nacimiento deberán completar esos datos al guardar su perfil. No se inventan datos personales para migrarlas.

## Requisitos y presentación

Requiere Node.js 22 o superior y una conexión a MongoDB configurada en `MONGODB_URI`.

Materialize 2 se sirve localmente desde `@materializecss/materialize`; el detalle utiliza un diálogo HTML nativo con sus estilos Materialize. Las fuentes de Google son opcionales y tienen fuentes de respaldo.

En esta instalación se preparó una cuenta de demostración `admin@nexo.local`. Su contraseña aleatoria está en `ADMIN_PASSWORD` de `.env`. Su teléfono y nacimiento son datos ficticios que puedes editar desde Mi cuenta.
