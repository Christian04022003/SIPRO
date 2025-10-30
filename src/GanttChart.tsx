import React, { useState } from 'react';
// Importa el componente principal y los modos de vista
import { FrappeGantt, ViewMode } from '@toyokoh/frappe-gantt-react';
// Importa los estilos CSS (necesario para el aspecto visual del Gantt)
import './styles/gantt.css';

// 1. Define los datos iniciales de tus tareas
const initialTasks = [
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    },
    {
        id: 'T1',
        name: 'Fase de Planificación',
        start: '2025-11-01',
        end: '2025-11-15',
        progress: 100,
        custom_class: 'bar-success'
    },
    {
        id: 'T2',
        name: 'Desarrollo de Módulos Core',
        start: '2025-11-16',
        end: '2025-12-10',
        progress: 70,
        dependencies: 'T1'
    },
    {
        id: 'T3',
        name: 'Pruebas Unitarias',
        start: '2025-12-05',
        end: '2025-12-20',
        progress: 0,
        dependencies: 'T2',
        custom_class: 'bar-milestone'
    },
    {
        id: 'T4',
        name: 'Implementación y Despliegue',
        start: '2025-12-21',
        end: '2025-12-30',
        progress: 0,
        dependencies: 'T3'
    }
];

// 2. Crea el componente funcional
const GanttChart = () => {
    // Definimos el estado para las tareas y el modo de vista (que controla el zoom)
    const [tasks, setTasks] = useState(initialTasks);
    const [viewMode, setViewMode] = useState(ViewMode.Month); // Estado del zoom

    // --- Manejadores de Eventos (Opcionales) ---

    const handleTaskClick = (task) => {
        console.log(`Tarea Clickeada: ${task.name}`);
    };

    const handleDateChange = (task, start, end) => {
        console.log(`Fechas cambiadas para ${task.name}. Nueva fecha de inicio: ${start}, fin: ${end}`);
        // **TODO:** Implementar la lógica de `setTasks` aquí para guardar los cambios
    };

    const handleProgressChange = (task, progress) => {
        console.log(`Progreso de ${task.name} cambiado a ${progress}%`);
        // **TODO:** Implementar la lógica de `setTasks` aquí para guardar los cambios
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Proyecto: Gestión de Tareas (Frappé Gantt en React)</h1>

            {/* 3. Selector de Modo de Vista (Control de Zoom) */}
            <div style={{ marginBottom: '15px' }}>
                <label>Modo de Vista (Zoom): </label>
                <select
                    value={viewMode}
                    // Al cambiar, actualiza el estado viewMode
                    onChange={(e) => setViewMode(e.target.value)}
                >
                    {/* El valor de cada option es el que Frappe Gantt usa para cambiar la escala de tiempo */}
                    <option value={ViewMode.Day}>Día (Máximo Zoom In)</option>
                    <option value={ViewMode.Week}>Semana</option>
                    <option value={ViewMode.Month}>Mes (Zoom Intermedio)</option>
                    <option value={ViewMode.Year}>Año (Máximo Zoom Out)</option>
                </select>
            </div>

            {/* 4. Renderiza el Componente FrappeGantt */}
            <FrappeGantt
                tasks={tasks}
                // La prop viewMode es lo que le dice al Gantt qué nivel de zoom usar
                viewMode={viewMode}
                onClick={handleTaskClick}
                onDateChange={handleDateChange}
                onProgressChange={handleProgressChange}
            />

            <p style={{ marginTop: '20px', fontSize: '12px' }}>
                * Las fechas y el progreso se pueden modificar arrastrando.
            </p>
        </div>
    );
};

export default GanttChart;