# Guía de Despliegue en Vercel - AgroGestión

## Requisitos Previos

- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [Firebase](https://firebase.google.com)
- Cuenta en [Sentry](https://sentry.io) (opcional pero recomendado)

**Nota:** AgroGestión ya no depende de APIs de Google o Gemini. Los mapas utilizan OpenStreetMap/CartoDB (gratis) y el clima usa Open-Meteo API (gratis).

## Pasos de Despliegue

### 1. Preparar variables de entorno

Solo necesitas configurar **Firebase**. Las demás APIs son completamente libres:

#### Firebase Configuration (REQUERIDO)
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto
3. Ve a Configuración del proyecto
4. En "Apps" agrega una aplicación web
5. Copia los 5 datos de configuración:
   - API Key
   - Auth Domain
   - Project ID
   - Storage Bucket
   - Messaging Sender ID
   - App ID

#### Sentry DSN (Opcional)
1. Ve a [Sentry](https://sentry.io) (opcional para monitoreo de errores)
2. Crea un nuevo proyecto
3. Copia el DSN para React

#### APIs Libres (Sin Configuración)
✅ **Mapas**: OpenStreetMap + CartoDB (gratis, sin API key)  
✅ **Clima**: Open-Meteo API (gratis, sin API key)  
✅ **Reportes**: LibreOffice/PDF (gratis, local)

### 2. Conectar Vercel con GitHub

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Haz clic en "Add New..." > "Project"
3. Selecciona el repositorio "AgroGesti-n"
4. Configura el despliegue:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

### 3. Configurar Variables de Entorno en Vercel

En el panel de configuración del proyecto en Vercel, agrega SOLO las siguientes variables de entorno:

```
# Firebase (requerido)
VITE_FIREBASE_API_KEY=<tu_firebase_api_key>
VITE_FIREBASE_AUTH_DOMAIN=<tu_firebase_auth_domain>
VITE_FIREBASE_PROJECT_ID=<tu_firebase_project_id>
VITE_FIREBASE_STORAGE_BUCKET=<tu_firebase_storage_bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<tu_firebase_messaging_sender_id>
VITE_FIREBASE_APP_ID=<tu_firebase_app_id>

# Sentry (opcional, para monitoreo de errores)
VITE_SENTRY_DSN=<tu_sentry_dsn>
```

**NO NECESITAS:**
- ❌ Google Maps API Key
- ❌ Gemini API Key
- ❌ Google Cloud Console

### 4. Configurar Firebase para Vercel

En Firebase Console:

1. Ve a Authentication > Sign-in method
2. Habilita:
   - Google
   - Email/Password
3. Ve a Authentication > Authorized domains
4. Agrega tu dominio de Vercel (ej: `agrogestion.vercel.app`)

### 5. Configurar Firestore

1. Ve a Firestore Database
2. Crea una base de datos en modo producción
3. Configura las reglas de seguridad:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /farms/{farmId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      match /{document=**} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/farms/$(farmId)).data.userId;
      }
    }
  }
}
```

### 6. Desplegar

1. Haz commit y push a la rama `claude/review-app-improvements-aBTtp`
2. Vercel automáticamente detectará los cambios y desplegará
3. Monitorea el despliegue en el dashboard de Vercel

### 7. Verificar el Despliegue

Después del despliegue:

1. Visita tu URL de Vercel
2. Prueba la autenticación con Google y email
3. Crea un campo de prueba
4. Verifica que todas las funcionalidades están activas

## Funcionalidades Disponibles

✅ **Reportes**: Genera PDF y Excel con resumen financiero
✅ **Análisis Financiero**: Gráficos de flujo de caja y análisis de gastos
✅ **Clima**: Pronóstico integrado con alertas
✅ **Inventario**: Gestión de semillas, fertilizantes y medicinas
✅ **Notificaciones**: Sistema de alertas y notificaciones
✅ **Búsqueda Avanzada**: Filtros complejos en toda la aplicación
✅ **Offline**: Funciona sin conexión con sincronización posterior
✅ **Monitoreo**: Sentry para tracking de errores

## Troubleshooting

### Error: "Firebase initialization failed"
- Verifica que todas las variables de Firebase estén correctamente configuradas
- Asegúrate de que el dominio de Vercel esté autorizado en Firebase
- Confirma que Firestore Database está habilitada en tu proyecto Firebase

### Error: "Mapas no cargan correctamente"
- Los mapas usan OpenStreetMap/CartoDB (sin API key)
- Esto es un problema local; verifica tu conexión internet
- Los mapas deberían cargar automáticamente sin configuración adicional

### Error: "El clima no se muestra"
- El clima usa Open-Meteo API (completamente gratis, sin API key)
- Si no muestra, verifica que tu dominio de Vercel pueda hacer requests HTTP
- Los datos de clima se actualizan cada 30 minutos

### Error: "Autenticación con Google no funciona"
- Verifica que hayas habilitado "Google" en Firebase Authentication
- Asegúrate de que el dominio de Vercel esté en "Authorized domains"
- Si es localhost, Firebase debe permitir aplicaciones locales en authentication settings

## Actualizaciones Futuras

Para actualizar la aplicación en producción:

1. Haz cambios locales
2. Verifica que pasen los type checks: `npm run type-check`
3. Haz commit y push a la rama
4. Vercel automáticamente desplegará los cambios

## Monitoreo

- **Sentry** (opcional): Recibe alertas de errores en tiempo real
- **Vercel Analytics**: Monitorea rendimiento y uptime
- **Firebase Console**: Monitorea uso de Firestore y autenticación
- **OpenStreetMap**: Sin límites de uso
- **Open-Meteo**: Sin límites de uso

## Soporte

Para reportar problemas:
1. Revisa los logs en el dashboard de Vercel
2. Verifica Sentry para errores en tiempo real
3. Consulta los logs del navegador (F12)

