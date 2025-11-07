// src/components/CustomGantt.tsx
import React, { useMemo, useCallback } from 'react';
import { TaskWithCPM, ViewModeType } from '../types';
import { BAR_HEIGHT, BAR_PADDING, ROW_HEIGHT_PX, ViewMode } from '../constants';

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
    const headerHeight = 45;
    const today = new Date();

    const taskMap = useMemo(() => new Map<string, TaskWithCPM>(tasks.map((t) => [t.id, t])), [tasks]);
    
    // --- Cálculo de Fechas y Escala ---
    const { start: projectStart, end: projectEnd } = useMemo(() => {
        const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
        const start = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
        const end = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;
        return { start, end };
    }, [tasks]);

    const scaleFactor = useMemo(() => {
        switch (viewMode) {
            case ViewMode.Day: return 100;
            case ViewMode.Week: return 40;
            case ViewMode.Month: return 20;
            case ViewMode.Year: return 5;
            default: return 30;
        }
    }, [viewMode]);

    const daysInProject = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const svgWidth = daysInProject * scaleFactor + 50;

    const getXPosition = useCallback((dateString: string): number => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 0;
        const daysDifference = Math.ceil((date.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        return daysDifference * scaleFactor;
    }, [projectStart, scaleFactor]);

    // --- Time Axis (Cuadrícula y Cabecera) ---
    const timeAxis = useMemo(() => { 
        const axis = [];
        let current = new Date(projectStart);
        current.setDate(current.getDate() - 1); 

        while (current <= projectEnd) {
            current.setDate(current.getDate() + 1);
            axis.push({ date: new Date(current), monthName: current.getDate() === 1 ? current.toLocaleString('es-ES', { month: 'short' }) : null });
        }
        return axis;
    }, [projectStart, projectEnd]);


    // --- Barras de Tareas ---
    const taskBars = tasks.map((task, index) => {
        if (!task.start || !task.end || isNaN(new Date(task.start).getTime()) || isNaN(new Date(task.end).getTime())) { return null; }

        const xStart = getXPosition(task.start);
        const xEnd = getXPosition(task.end) + scaleFactor;
        const width = xEnd - xStart;
        const y = headerHeight + index * rowHeight + barPadding;
        const isMilestone = task.start === task.end;
        const criticalColor = '#DC2626'; // Rojo
        const nonCriticalColor = task.parentId ? '#6D28D9' : '#3B82F6'; // Púrpura vs Azul
        const bgColor = task.isCritical ? criticalColor : nonCriticalColor;
        const progressWidth = width * (task.progress / 100);
        
        // Renderizado de Hitos y Barras
        if (isMilestone) {
             return (
                <g key={task.id} style={{ cursor: 'pointer' }}>
                    <rect x={xStart} y={y - 8} width={16} height={16} fill={bgColor} transform={`rotate(45 ${xStart + 8} ${y})`} />
                    <title>{`${task.name} (Hito) - ${task.start} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
                </g>
            );
        }
        
        return (
            <g key={task.id} style={{ cursor: 'pointer' }}>
                <rect x={xStart} y={y} width={width} height={barHeight} fill="#E5E7EB" rx="3" />
                <rect x={xStart} y={y} width={progressWidth} height={barHeight} fill={bgColor} rx="3" />
                <title>{`${task.name} (${task.progress}%) - ${task.start} a ${task.end} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
            </g>
        );
    }).filter(Boolean);

    // --- Líneas de Dependencia ---
    const dependencyLines = useMemo(() => {
        const lines: JSX.Element[] = [];
        // ... (Lógica de líneas de dependencia, similar a la Parte 2) ...
        return lines;
    }, [tasks, taskMap, getXPosition, scaleFactor, headerHeight, rowHeight, barPadding, barHeight]);

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

                {/* Cuadrícula y Cabecera */}
                <g>
                    {/* Líneas de la cuadrícula vertical */}
                    {timeAxis.map((day, index) => (
                        <line 
                            key={`grid-${index}`} 
                            x1={getXPosition(day.date.toISOString().split('T')[0])} 
                            y1={headerHeight} 
                            x2={getXPosition(day.date.toISOString().split('T')[0])} 
                            y2={svgHeight} 
                            stroke="#E5E7EB" 
                            strokeWidth="1" 
                        />
                    ))}
                    
                    {/* Línea de Hoy */}
                    <line 
                        x1={getXPosition(today.toISOString().split('T')[0])} 
                        y1={0} 
                        x2={getXPosition(today.toISOString().split('T')[0])} 
                        y2={svgHeight} 
                        stroke="#EF4444" 
                        strokeWidth="2" 
                    />
                    
                    {/* Nombres de Meses (Renderizado simple en la parte superior) */}
                    {timeAxis.filter(d => d.monthName).map((month, index) => (
                         <text
                            key={`month-${index}`}
                            x={getXPosition(month.date.toISOString().split('T')[0]) + scaleFactor * 10}
                            y={18}
                            style={{ fontSize: '12px', fill: '#4B5563', fontWeight: 'bold' }}
                        >
                            {month.date.toLocaleString('es-ES', { year: 'numeric', month: 'short' })}
                        </text>
                    ))}

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

// const CustomGantt = React.memo(({ tasks, viewMode, scrollRef, onScroll }) => {
//     const barHeight = BAR_HEIGHT;
//     const barPadding = BAR_PADDING;
//     const rowHeight = ROW_HEIGHT_PX;
//     const headerHeight = 35;
//     const today = useMemo(() => new Date(), []); // Memoizar "hoy"

//     const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

//     // --- Cálculo de Fechas y Escala ---
//     const { start: projectStart, end: projectEnd } = useMemo(() => {
//         const dates = tasks.flatMap(t => [new Date(t.start), new Date(t.end)]).filter(d => !isNaN(d.getTime()));
//         const start = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : today;
//         const end = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : today;
//         return { start, end };
//     }, [tasks, today]);

//     const scaleFactor = useMemo(() => {
//         switch (viewMode) {
//             case ViewMode.Day: return 35; // Escala por día
//             case ViewMode.Week: return 10; // Escala por semana (más días en la vista)
//             case ViewMode.Month: return 5; // Escala por mes
//             default: return 5;
//         }
//     }, [viewMode]);

//     const daysInProject = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
//     const svgWidth = daysInProject * scaleFactor + 200; // Añadir margen derecho

//     const getXPosition = useCallback((dateString) => {
//         const date = new Date(dateString);
//         if (isNaN(date.getTime())) return 0;
//         const daysDifference = Math.ceil((date.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
//         return daysDifference * scaleFactor;
//     }, [projectStart, scaleFactor]);

//     const timeAxis = useMemo(() => {
//         const axis = [];
//         let current = new Date(projectStart);
//         current.setDate(current.getDate());

//         while (current <= projectEnd) {
//             axis.push({ date: new Date(current) });
//             current.setDate(current.getDate() + 1);
//         }
//         return axis;
//     }, [projectStart, projectEnd]);

//     // --- Barras de Tareas ---
//     const taskBars = tasks.map((task, index) => {
//         if (!task.start || !task.end || isNaN(new Date(task.start).getTime()) || isNaN(new Date(task.end).getTime())) { return null; }

//         const xStart = getXPosition(task.start);
//         const xEnd = getXPosition(task.end) + scaleFactor;
//         const width = Math.max(0, xEnd - xStart); // Asegura que el ancho no sea negativo
//         const y = headerHeight + index * rowHeight + barPadding;
//         const isMilestone = task.isMilestone || (task.start === task.end && task.progress === 100);
//         const criticalColor = '#DC2626'; // Rojo
//         const nonCriticalColor = task.parentId ? '#6D28D9' : '#3B82F6'; // Púrpura vs Azul
//         const bgColor = task.isCritical ? criticalColor : nonCriticalColor;
//         const progressWidth = width * (task.progress / 100);

//         // Renderizado de Hitos y Barras
//         if (isMilestone) {
//              return (
//                 <g key={task.id} style={{ cursor: 'pointer' }}>
//                     {/* Diamante rotado */}
//                     <rect x={xStart} y={y - 8} width={16} height={16} fill={bgColor} transform={`rotate(45 ${xStart + 8} ${y})`} rx="2" />
//                     <title>{`${task.name} (Hito) - ${task.start} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
//                 </g>
//             );
//         }

//         return (
//             <g key={task.id} style={{ cursor: 'pointer' }}>
//                 {/* Barra de fondo */}
//                 <rect x={xStart} y={y} width={width} height={barHeight} fill="#E5E7EB" rx="3" />
//                 {/* Barra de progreso */}
//                 <rect x={xStart} y={y} width={progressWidth} height={barHeight} fill={bgColor} rx="3" />
//                 {/* Texto de progreso (opcional) */}
//                  {task.progress > 0 && (
//                     <text x={xStart + progressWidth + 5} y={y + 15} style={{ fontSize: '10px', fill: '#1F2937' }}>
//                         {task.progress}%
//                     </text>
//                  )}
//                 <title>{`${task.name} (${task.progress}%) - ${task.start} a ${task.end} - ${task.isCritical ? 'CRÍTICO' : 'No Crítico'}`}</title>
//             </g>
//         );
//     }).filter(Boolean);

//     // --- Líneas de Dependencia ---
//     const dependencyLines = useMemo(() => {
//         const lines = [];

//         tasks.forEach((sourceTask, sourceIndex) => {
//             if (!sourceTask.dependencies) return;

//             // La tarea actual (sourceTask) depende de (targetId)
//             const targetIds = sourceTask.dependencies.split(',').map(id => id.trim()).filter(Boolean);

//             targetIds.forEach(targetId => {
//                 const targetTask = taskMap.get(targetId);
//                 if (!targetTask) return;

//                 const targetIndex = tasks.findIndex(t => t.id === targetId);

//                 if (targetIndex !== -1) {
//                     // Start (End of Target Task)
//                     const xStart = getXPosition(targetTask.end) + scaleFactor;
//                     const yStart = headerHeight + targetIndex * rowHeight + rowHeight / 2;
//                     // End (Start of Source Task)
//                     const xEnd = getXPosition(sourceTask.start);
//                     const yEnd = headerHeight + sourceIndex * rowHeight + rowHeight / 2;

//                     // Determinamos si la dependencia es crítica
//                     const isCriticalDep = sourceTask.isCritical && targetTask.isCritical && sourceTask.totalSlack === 0;
//                     const strokeColor = isCriticalDep ? '#991b1b' : '#6B7280';
//                     const marker = isCriticalDep ? 'url(#arrowhead-critical)' : 'url(#arrowhead-normal)';

//                     // Enrutamiento: Derecha -> Abajo/Arriba -> Izquierda (para evitar superposición con la barra)
//                     const midX = xStart + 10;
//                     const path = `M ${xStart} ${yStart} L ${midX} ${yStart} L ${midX} ${yEnd} L ${xEnd} ${yEnd}`;

//                     lines.push(
//                         <path
//                             key={`${targetId}-${sourceTask.id}`}
//                             d={path}
//                             stroke={strokeColor}
//                             strokeWidth="1.5"
//                             fill="none"
//                             markerEnd={marker}
//                             opacity={isCriticalDep ? 1.0 : 0.6}
//                         />
//                     );
//                 }
//             });
//         });

//         return lines;
//     }, [tasks, taskMap, getXPosition, scaleFactor, headerHeight, rowHeight]);

//     const svgHeight = headerHeight + tasks.length * rowHeight;

//     return (
//         <div
//             ref={scrollRef}
//             onScroll={onScroll}
//             style={{
//                 width: '100%',
//                 height: '100%',
//                 overflow: 'auto',
//                 backgroundColor: 'white'
//             }}
//         >
//             <svg width={svgWidth} height={svgHeight}>
//                 {/* Definiciones de Flechas */}
//                 <defs>
//                     <marker id="arrowhead-normal" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="10 3.5, 0 0, 0 7" fill="#6B7280" /></marker>
//                     <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="10 3.5, 0 0, 0 7" fill="#991b1b" /></marker>
//                 </defs>

//                 {/* Cuadrícula y Cabecera */}
//                 <g>
//                     {/* Líneas de la cuadrícula vertical y etiquetas */}
//                     {timeAxis.map((day, index) => {
//                         const dateString = day.date.toISOString().split('T')[0];
//                         const x = getXPosition(dateString);
//                         const isDayOne = day.date.getDate() === 1;

//                         return (
//                             <React.Fragment key={`col-${index}`}>
//                                 {/* Líneas de la cuadrícula */}
//                                 <line
//                                     x1={x}
//                                     y1={headerHeight}
//                                     x2={x}
//                                     y2={svgHeight}
//                                     stroke={isDayOne ? '#D1D5DB' : '#F3F4F6'}
//                                     strokeWidth="1"
//                                 />

//                                 {/* Etiquetas de días/meses */}
//                                 {viewMode === ViewMode.Day && (
//                                     <text x={x + scaleFactor / 2} y={35} textAnchor="middle" style={{ fontSize: '9px', fill: '#4B5563' }}>
//                                         {day.date.getDate()}
//                                     </text>
//                                 )}
//                                 {(viewMode === ViewMode.Week || viewMode === ViewMode.Month) && isDayOne && (
//                                     <text x={x} y={18} style={{ fontSize: '12px', fill: '#4B5563', fontWeight: 'bold' }}>
//                                         {day.date.toLocaleString('es-ES', { month: 'short', year: 'numeric' })}
//                                     </text>
//                                 )}
//                             </React.Fragment>
//                         );
//                     })}

//                     {/* Línea de Hoy */}
//                     <line
//                         x1={getXPosition(today.toISOString().split('T')[0])}
//                         y1={0}
//                         x2={getXPosition(today.toISOString().split('T')[0])}
//                         y2={svgHeight}
//                         stroke="#EF4444"
//                         strokeWidth="2"
//                     />

//                     <line x1="0" y1={headerHeight} x2={svgWidth} y2={headerHeight} stroke="#D1D5DB" strokeWidth="1" />
//                 </g>

//                 {/* Líneas de Dependencia */}
//                 <g>{dependencyLines}</g>

//                 {/* Barras de Tareas */}
//                 <g>{taskBars}</g>
//             </svg>
//         </div>
//     );
// });