// TaskData.js
export const initialTasks = [
    // Tarea Padre
    { id: 'T1', name: 'Fase de Planificación', start: '2025-11-01', end: '2025-11-15', progress: 100, parentId: null, duration: 15 },

    // Subtareas de T1
    { id: 'S1-1', name: 'Definir Alcance', start: '2025-11-01', end: '2025-11-07', progress: 100, parentId: 'T1', duration: 7 },
    { id: 'S1-2', name: 'Estimar Recursos', start: '2025-11-08', end: '2025-11-15', progress: 80, parentId: 'T1', dependencies: 'S1-1', duration: 8 },

    // Tarea Padre 2
    { id: 'T2', name: 'Desarrollo de Módulos Core', start: '2025-11-16', end: '2025-12-10', progress: 70, parentId: null, dependencies: 'T1', duration: 25 },
];