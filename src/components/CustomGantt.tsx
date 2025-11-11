import React, { useMemo, useCallback } from 'react';
// Tipos y Constantes inyectados para asegurar que el archivo sea autocontenido

// --- CONSTANTES ---
const BAR_HEIGHT = 16;
const BAR_PADDING = 4;
const ROW_HEIGHT_PX = 30;
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

const CustomGantt: React.FC<CustomGanttProps> = ({ tasks, viewMode, scrollRef, onScroll }) => {
    const barHeight = BAR_HEIGHT;
    const barPadding = BAR_PADDING;
    const rowHeight = ROW_HEIGHT_PX;
    const headerHeight = 45; // Altura de la cabecera de tiempo
    const today = new Date();

    const taskMap = useMemo(() => new Map<string, TaskWithCPM>(tasks.map((t) => [t.id, t])), [tasks]);
    
    // --- Cálculo de Fechas y Escala ---
    const { start: projectStart, end: projectEnd } = useMemo(() => {
        const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
        // Añadir una ventana de tiempo si no hay tareas para evitar errores
        const defaultStart = new Date();
        const defaultEnd = new Date(defaultStart);
        defaultEnd.setDate(defaultEnd.getDate() + 30); // 30 días si está vacío
        
        const start = dates.length ? new Date(Math.min(...dates.map(d => new Date(d).setHours(0, 0, 0, 0)))) : defaultStart;
        const end = dates.length ? new Date(Math.max(...dates.map(d => new Date(d).setHours(23, 59, 59, 999)))) : defaultEnd;
        
        // Ajustar el inicio para incluir un margen si es necesario
        start.setDate(start.getDate() - 2); 
        return { start, end };
    }, [tasks]);

    const scaleFactor = useMemo(() => {
        // Ajustar el factor de escala para la visualización por día
        switch (viewMode) {
            case ViewMode.Day: return 35; 
            case ViewMode.Week: return 10; 
            case ViewMode.Month: return 5; 
            case ViewMode.Year: return 1; 
            default: return 5;
        }
    }, [viewMode]);

    const daysInProject = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const svgWidth = daysInProject * scaleFactor + 50;

    const getXPosition = useCallback((dateString: string): number => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 0;
        // La diferencia en días (redondeado para asegurar que los fines de tarea se mapeen correctamente)
        const diffTime = date.getTime() - projectStart.getTime();
        const daysDifference = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return daysDifference * scaleFactor;
    }, [projectStart, scaleFactor]);

    // --- Time Axis (Genera un objeto por cada día para la cuadrícula) ---
    const timeAxis = useMemo(() => { 
        const axis = [];
        let current = new Date(projectStart);

        while (current <= projectEnd) {
            axis.push({ 
                date: new Date(current)
            });
            current.setDate(current.getDate() + 1);
        }
        return axis;
    }, [projectStart, projectEnd]);


    // --- Barras de Tareas ---
    const taskBars = tasks.map((task, index) => {
        if (!task.start || !task.end || isNaN(new Date(task.start).getTime()) || isNaN(new Date(task.end).getTime())) { return null; }

        const xStart = getXPosition(task.start);
        const xEnd = getXPosition(task.end) + scaleFactor;
        const width = Math.max(0, xEnd - xStart); // Asegura que el ancho no sea negativo
        const y = headerHeight + index * rowHeight + barPadding;
        const isMilestone = task.start === task.end || task.duration === 0;
        
        const criticalColor = '#DC2626'; // Rojo - Crítico
        const nonCriticalColor = task.parentId ? '#6D28D9' : '#3B82F6'; // Púrpura (hijo) vs Azul (padre)
        const bgColor = task.isCritical ? criticalColor : nonCriticalColor;
        const progressWidth = width * (task.progress / 100);
        
        // Renderizado de Hitos y Barras
        if (isMilestone) {
             return (
                <g key={task.id} style={{ cursor: 'pointer' }}>
                    {/* Hito: Diamante rotado */}
                    <rect x={xStart} y={y - 8} width={16} height={16} fill={bgColor} transform={`rotate(45 ${xStart + 8} ${y})`} rx="2" />
                    <title>{`${task.name} (Hito) - ${task.start} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
                </g>
            );
        }
        
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
    }).filter(Boolean);

    // --- Líneas de Dependencia (Implementación del enrutamiento) ---
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

                    // Determinamos si la dependencia es crítica (asumiendo totalSlack en TaskWithCPM)
                    const isCriticalDep = sourceTask.isCritical && targetTask.isCritical && sourceTask.totalSlack === 0;
                    const strokeColor = isCriticalDep ? '#991b1b' : '#6B7280';
                    const marker = isCriticalDep ? 'url(#arrowhead-critical)' : 'url(#arrowhead-normal)';

                    // Enrutamiento: Derecha -> Abajo/Arriba -> Izquierda
                    // MidX se mueve 10px a la derecha del final de la tarea objetivo
                    const midX = xStart + 10;
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

    return (
        <div 
            ref={scrollRef} 
            onScroll={onScroll} 
            style={{ 
                width: '100%', 
                height: '100%', 
                overflow: 'auto', 
                backgroundColor: 'white' 
            }}
        >
            <svg width={svgWidth} height={svgHeight}>
                {/* Definiciones de Flechas */}
                <defs>
                    <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="10 3.5, 0 0, 0 7" fill="#6B7280" /></marker>
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

                        // Color y grosor de línea según el modo de vista y la fecha
                        const strokeColor = isStartOfMonth ? '#D1D5DB' : '#F3F4F6';
                        
                        // Determinar si dibujar la etiqueta del día
                        const shouldDrawDayLabel = viewMode === ViewMode.Day && index % 1 === 0;
                        // Determinar si dibujar la etiqueta del mes/semana
                        const shouldDrawHeaderLabel = (viewMode === ViewMode.Week && isStartOfWeek) || isStartOfMonth;

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

                                {/* Etiqueta del Día (Modo Día) */}
                                {shouldDrawDayLabel && (
                                    <text 
                                        x={x + scaleFactor / 2} 
                                        y={35} 
                                        textAnchor="middle" 
                                        style={{ fontSize: '9px', fill: '#4B5563' }}
                                    >
                                        {date.getDate()}
                                    </text>
                                )}
                                
                                {/* Etiqueta del Mes/Semana (Modos Semana/Mes/Año) */}
                                {shouldDrawHeaderLabel && (
                                    <text 
                                        x={x + 5} 
                                        y={18} 
                                        style={{ fontSize: '12px', fill: '#4B5563', fontWeight: 'bold' }}
                                    >
                                        {date.toLocaleString('es-ES', { month: 'short', year: 'numeric' })}
                                    </text>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Línea de Hoy */}
                    <line 
                        x1={getXPosition(today.toISOString().split('T')[0])} 
                        y1={0} 
                        x2={getXPosition(today.toISOString().split('T')[0])} 
                        y2={svgHeight} 
                        stroke="#EF4444" 
                        strokeWidth="2" 
                    />
                    
                    {/* Separador de cabecera */}
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