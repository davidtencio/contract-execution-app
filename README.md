# Medication Contract Execution App

Sistema de control de ejecución de contratos de medicamentos.

## Requisitos Previos
- Node.js (v18 o superior)
- npm

## Instalación

1.  Navegar al directorio:
    ```bash
    cd contract-execution-app
    ```

2.  Instalar dependencias:
    ```bash
    npm install
    ```

## Ejecución

### Desarrollo
Para iniciar el servidor local con recarga automática:
```bash
npm run dev
```

### Producción
Para construir la aplicación para despliegue:
```bash
npm run build
```

Para probar la versión construida localmente:
```bash
npm run preview
```

## Estructura
- `src/components`: Componentes reutilizables (Wizard, Sidebar, KPI Cards).
- `src/pages`: Vistas principales (Dashboard, Detalles).
- `src/services`: Lógica de negocio y simulación de base de datos.

## Solución de Problemas (Windows)

Si obtienes un error como `...porque la ejecución de scripts está deshabilitada`, es por la política de seguridad de PowerShell.

**Opción A: Usar CMD (Símbolo del sistema)**
En lugar de PowerShell, abre `cmd.exe` y ejecuta los comandos ahí.

**Opción B: Permitir scripts en PowerShell**
Ejecuta este comando como Administrador:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Luego intenta `npm run dev` nuevamente.
