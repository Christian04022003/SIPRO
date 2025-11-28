import React, { useMemo, useCallback } from 'react';

// --- CONSTANTES ---
const BAR_HEIGHT = 16;
const BAR_PADDING = 4;
const ROW_HEIGHT_PX = 30;
const HEADER_HEIGHT = 45; // Altura de la cabecera de tiempo

enum ViewMode {
    Day = 'Day',
    Week = 'Week',
    Month = 'Month',
    Year = 'Year',
}

// --- TIPOS ---
type ViewModeType = 'Day' | 'Week' | 'Month' | 'Year';

interface TaskWithCPM {
    id: string;
    name: string;
    start: string; // ISO Date string
    end: string; // ISO Date string
    duration: number; // in days
    progress: number; // 0-100
    dependencies: string; // Comma-separated IDs
    parentId?: string;
    isCritical: boolean;
    totalSlack: number;
}

interface CustomGanttProps {
    tasks: TaskWithCPM[];
    viewMode: ViewModeType;
    scrollRef: React.RefObject<HTMLDivElement>;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}
// ----------------------------------------------------------------

const CustomGantt: React.FC<CustomGanttProps> = ({ tasks, viewMode, scrollRef, onScroll }) => {
    
    // Simplificación de constantes internas
    const barHeight = BAR_HEIGHT;
    const barPadding = BAR_PADDING;
    const rowHeight = ROW_HEIGHT_PX;
    const headerHeight = HEADER_HEIGHT; 
    const today = new Date();

    // Mapeo de tareas para búsqueda eficiente
    const taskMap = useMemo(() => new Map<string, TaskWithCPM>(tasks.map((t) => [t.id, t])), [tasks]);
    
    // --- Cálculo de Fechas de Proyecto y Escala ---
    const { projectStart, projectEnd } = useMemo(() => {
        const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
        
        // Valores predeterminados si no hay tareas
        const defaultStart = new Date();
        const defaultEnd = new Date(defaultStart);
        defaultEnd.setDate(defaultEnd.getDate() + 30); 
        
        // Calcular inicio y fin del proyecto (Asegurando la medianoche para el inicio y el final del día)
        const startTimestamp = dates.length ? Math.min(...dates.map(d => new Date(d).setHours(0, 0, 0, 0))) : defaultStart.getTime();
        const endTimestamp = dates.length ? Math.max(...dates.map(d => new Date(d).setHours(23, 59, 59, 999))) : defaultEnd.getTime();
        
        const start = new Date(startTimestamp);
        const end = new Date(endTimestamp);
        
        // Ajustar el inicio para incluir un margen (2 días)
        start.setDate(start.getDate() - 2); 

        return { projectStart: start, projectEnd: end };
    }, [tasks]);

    const scaleFactor = useMemo(() => {
        // Ajustar el factor de escala (pixels por día) según el modo de vista
        switch (viewMode) {
            case ViewMode.Day: return 35; // 35px por día
            case ViewMode.Week: return 10; // 10px por día (Zoom out)
            case ViewMode.Month: return 5; 
            case ViewMode.Year: return 1; 
            default: return 5;
        }
    }, [viewMode]);

    const daysInProject = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const svgWidth = daysInProject * scaleFactor + 50; // +50 para margen derecho

    // Función para obtener la posición X de una fecha
    const getXPosition = useCallback((dateString: string): number => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 0;
        
        const diffTime = new Date(date.setHours(0, 0, 0, 0)).getTime() - new Date(projectStart.setHours(0, 0, 0, 0)).getTime();
        const daysDifference = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return daysDifference * scaleFactor;
    }, [projectStart, scaleFactor]);

    // --- Time Axis (Datos para la Cuadrícula y la Cabecera) ---
    const timeAxis = useMemo(() => { 
        const axis = [];
        // Clonar la fecha de inicio para no mutar el original
        let current = new Date(projectStart); 

        while (current <= projectEnd) {
            axis.push({ 
                date: new Date(current)
            });
            current.setDate(current.getDate() + 1);
        }
        return axis;
    }, [projectStart, projectEnd]);


    // --- Barras de Tareas (SVG) ---
    const taskBars = useMemo(() => tasks.map((task, index) => {
        // Validación básica
        if (!task.start || !task.end || isNaN(new Date(task.start).getTime()) || isNaN(new Date(task.end).getTime())) { return null; }

        const xStart = getXPosition(task.start);
        // El final debe incluir la duración del último día
        const xEnd = getXPosition(task.end) + scaleFactor; 
        const width = Math.max(scaleFactor, xEnd - xStart); // Asegura un ancho mínimo de 1 día
        const y = headerHeight + index * rowHeight + barPadding;
        
        // Hito si la duración es cero o si es el mismo día
        const isMilestone = task.start === task.end || task.duration === 0;
        
        const criticalColor = '#DC2626'; // Rojo - Crítico
        const nonCriticalColor = task.parentId ? '#6D28D9' : '#3B82F6'; // Púrpura (hijo) vs Azul (padre)
        const bgColor = task.isCritical ? criticalColor : nonCriticalColor;
        const progressWidth = width * (task.progress / 100);
        
        // Renderizado de Hitos (Diamante)
        if (isMilestone) {
             return (
                <g key={task.id} style={{ cursor: 'pointer' }}>
                    {/* Hito: Diamante rotado */}
                    <rect x={xStart - 8} y={y - 8} width={barHeight} height={barHeight} fill={bgColor} transform={`rotate(45 ${xStart} ${y})`} rx="2" />
                    <title>{`${task.name} (Hito) - ${task.start} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
                </g>
            );
        }
        
        // Renderizado de Barras
        return (
            <g key={task.id} style={{ cursor: 'pointer' }}>
                {/* Barra de fondo */}
                <rect x={xStart} y={y} width={width} height={barHeight} fill="#E5E7EB" rx="3" />
                {/* Barra de progreso */}
                <rect x={xStart} y={y} width={progressWidth} height={barHeight} fill={bgColor} rx="3" />
                {/* Texto de progreso (opcional) */}
                 {width > 50 && task.progress > 0 && (
                    <text x={xStart + progressWidth + 5} y={y + 12} style={{ fontSize: '10px', fill: '#1F2937' }}>
                        {task.progress}%
                    </text>
                 )}
                <title>{`${task.name} (${task.progress}%) - ${task.start} a ${task.end} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
            </g>
        );
    }).filter(Boolean), [tasks, getXPosition, scaleFactor, headerHeight, rowHeight, barPadding]);

    // --- Líneas de Dependencia (Enrutamiento 'Codo' o L-Shape) ---
    const dependencyLines = useMemo(() => {
        const lines: JSX.Element[] = [];

        tasks.forEach((sourceTask, sourceIndex) => {
            // sourceTask depende de targetId(s)
            if (!sourceTask.dependencies) return;

            const targetIds = sourceTask.dependencies.split(',').map(id => id.trim()).filter(Boolean);

            targetIds.forEach(targetId => {
                const targetTask = taskMap.get(targetId);
                if (!targetTask) return;

                const targetIndex = tasks.findIndex(t => t.id === targetId);

                if (targetIndex !== -1) {
                    // Start point (End of Target Task)
                    const xStart = getXPosition(targetTask.end) + scaleFactor;
                    const yStart = headerHeight + targetIndex * rowHeight + rowHeight / 2;
                    
                    // End point (Start of Source Task)
                    const xEnd = getXPosition(sourceTask.start);
                    const yEnd = headerHeight + sourceIndex * rowHeight + rowHeight / 2;

                    // Lógica para determinar si la dependencia es crítica
                    // Asumimos que es crítica si ambas tareas son críticas Y la holgura de la tarea fuente es 0
                    const isCriticalDep = sourceTask.isCritical && targetTask.isCritical && sourceTask.totalSlack === 0;
                    const strokeColor = isCriticalDep ? '#991b1b' : '#6B7280';
                    const marker = isCriticalDep ? 'url(#arrowhead-critical)' : 'url(#arrowhead-normal)';

                    // Enrutamiento: Derecha (10px buffer) -> Abajo/Arriba -> Izquierda
                    const midX = xStart + 10;
                    // M xStart yStart: Mover al inicio. L midX yStart: Derecha. L midX yEnd: Abajo/Arriba. L xEnd yEnd: Izquierda hasta la tarea.
                    const path = `M ${xStart} ${yStart} L ${midX} ${yStart} L ${midX} ${yEnd} L ${xEnd} ${yEnd}`;

                    lines.push(
                        <path
                            key={`${targetId}-${sourceTask.id}`}
                            d={path}
                            stroke={strokeColor}
                            strokeWidth="1.5"
                            fill="none"
                            markerEnd={marker}
                            opacity={isCriticalDep ? 1.0 : 0.8}
                        />
                    );
                }
            });
        });
        return lines;
    }, [tasks, taskMap, getXPosition, scaleFactor, headerHeight, rowHeight]);

    const svgHeight = headerHeight + tasks.length * rowHeight;

    // --- Renderizado Principal ---
    return (
        <div 
            ref={scrollRef} 
            onScroll={onScroll} 
            style={{ 
                width: '100%', 
                height: '100%', 
                overflow: 'auto', 
                backgroundColor: 'white',
                minWidth: '500px' // Mínimo para que el scroll funcione
            }}
        >
            <svg width={svgWidth} height={svgHeight}>
                {/* Definiciones de Flechas (Arrowheads) */}
                <defs>
                    {/* Flecha Normal */}
                    <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="10 3.5, 0 0, 0 7" fill="#6B7280" /></marker>
                    {/* Flecha Crítica */}
                    <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="10 3.5, 0 0, 0 7" fill="#991b1b" /></marker>
                </defs>

                {/* Cuadrícula y Cabecera de Tiempo */}
                <g>
                    {timeAxis.map((day, index) => {
                        const dateString = day.date.toISOString().split('T')[0];
                        const x = getXPosition(dateString);
                        const date = day.date;
                        const isStartOfWeek = date.getDay() === 0; // Domingo
                        const isStartOfMonth = date.getDate() === 1;

                        // Color de línea de cuadrícula
                        const strokeColor = isStartOfMonth ? '#D1D5DB' : '#F3F4F6';
                        
                        // Lógica de Etiquetas de Cabecera (Simplificada para mejor UX en diferentes vistas)
                        let dayLabel, headerLabel;

                        if (viewMode === ViewMode.Day) {
                            dayLabel = date.getDate(); // Muestra el número del día
                        } else if (viewMode === ViewMode.Week && isStartOfWeek) {
                            headerLabel = date.toLocaleString('es-ES', { day: 'numeric', month: 'short' }); // Inicio de semana
                        } else if (viewMode === ViewMode.Month && isStartOfMonth) {
                            headerLabel = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }); // Inicio de mes
                        } else if (viewMode === ViewMode.Year && isStartOfMonth) {
                            headerLabel = date.toLocaleString('es-ES', { month: 'short', year: 'numeric' }); // Inicio de mes
                        }

                        return (
                            <React.Fragment key={`col-${index}`}>
                                {/* Línea de la cuadrícula vertical */}
                                <line
                                    x1={x}
                                    y1={headerHeight}
                                    x2={x}
                                    y2={svgHeight}
                                    stroke={strokeColor}
                                    strokeWidth="1"
                                />

                                {/* Etiqueta del Día (Parte Inferior de la cabecera) */}
                                {dayLabel && (
                                    <text 
                                        x={x + scaleFactor / 2} 
                                        y={35} 
                                        textAnchor="middle" 
                                        style={{ fontSize: '9px', fill: '#4B5563' }}
                                    >
                                        {dayLabel}
                                    </text>
                                )}
                                
                                {/* Etiqueta del Mes/Semana (Parte Superior de la cabecera) */}
                                {headerLabel && (
                                    <text 
                                        x={x + 5} 
                                        y={18} 
                                        style={{ fontSize: '12px', fill: '#4B5563', fontWeight: 'bold' }}
                                    >
                                        {headerLabel}
                                    </text>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Línea de Hoy (Roja y destacada) */}
                    <line 
                        x1={getXPosition(today.toISOString().split('T')[0])} 
                        y1={0} 
                        x2={getXPosition(today.toISOString().split('T')[0])} 
                        y2={svgHeight} 
                        stroke="#EF4444" 
                        strokeWidth="2" 
                    />
                    
                    {/* Separador de cabecera horizontal */}
                    <line x1="0" y1={headerHeight} x2={svgWidth} y2={headerHeight} stroke="#D1D5DB" strokeWidth="1" />
                </g>

                {/* Líneas de Dependencia */}
                <g>{dependencyLines}</g>

                {/* Barras de Tareas */}
                <g>{taskBars}</g>
            </svg>
        </div>
    );
};

export default CustomGantt;