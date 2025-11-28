import React, { useState, useEffect, useRef, useCallback } from 'react';

// ==========================================================
// DEFINICIONES Y UTILIDADES (Mantenidas)
// ==========================================================

/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** * @typedef {{ 
 * id: string, 
 * name: string, 
 * isCritical: boolean, 
 * totalSlack: number | 'N/A', 
 * index: string, 
 * priority: PriorityType, 
 * cost: number, 
 * progress: number, 
 * start: string, 
 * end: string, 
 * isMilestone?: boolean, 
 * parentId?: string, 
 * dependencies: string[], // ⬅️ Array simple de IDs para la columna
 * dependenciesDetails: string, // String complejo para el modal
 * }} TaskWithCPM 
 */
const ROW_HEIGHT_PX = 30; 

// FUNCIÓN DE PROFUNDIDAD (Mantenida)
const getTaskDepth = (task, allTasks) => {
    let depth = 0;
    let currentTask = task;
    const taskMap = allTasks.reduce((map, t) => {
        map[t.id] = t;
        return map;
    }, {});

    while (currentTask?.parentId) {
        currentTask = taskMap[currentTask.parentId];
        if (currentTask) {
            depth++;
        } else {
            break;
        }
    }
    return depth;
};
// ----------------------------------------------------------------

const EditableCell = React.memo(
    // @ts-ignore
    ({ 
        initialValue, 
        task, 
        columnId, 
        allTasks, 
        updateTaskData, 
        parentIds, 
        collapsedParents, 
        toggleCollapse, 
        addNewTask, 
        addNewMilestone,
        onManageDependencies,
        deleteTask 
    }) => {

    const isDependencyColumn = columnId === 'dependencies';
    const safeInitialValue = String(initialValue ?? '');
    const [value, setValue] = useState(safeInitialValue);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    // 1. Determinar si la tarea es PADRE (tiene hijos).
    const isParent = parentIds.has(task.id); 
    
    // 2. Definir si el campo es CALCULADO (Solo lectura).
    const isCalculatedField = isParent && (
        columnId === 'start' || 
        columnId === 'end' || 
        columnId === 'progress' || 
        columnId === 'cost'
    );

    // 3. Estilo para tareas Críticas
    const criticalStyle = task.isCritical ? {
        backgroundColor: '#FEF2F2', 
        borderLeft: '3px solid #DC2626', 
        fontWeight: 'bold',
    } : {};


    // Sincroniza el estado local con el valor de la tarea
    useEffect(() => { setValue(safeInitialValue); }, [safeInitialValue]);

    const onBlur = () => {
        setIsEditing(false);
        if (!isCalculatedField && String(value) !== String(initialValue)) {
            // Nota: Para la columna 'dependencies', la actualización va vía el modal.
            if (!isDependencyColumn) { 
                 updateTaskData(task.id, columnId, value);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { onBlur(); }
        else if (e.key === 'Escape') { setValue(safeInitialValue); setIsEditing(false); }
    };

    const handleDoubleClick = () => {
        if (isCalculatedField || columnId === 'index' || columnId === 'totalSlack' || isDependencyColumn) { 
            return;
        }
        
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    /** @type {PriorityType[]} */
    const priorityOptions = ['Alta', 'Media', 'Baja'];

    // Estilos base
    const defaultCellStyle = {
        height: `${ROW_HEIGHT_PX}px`,
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: '14px',
        cursor: isCalculatedField ? 'not-allowed' : 'default',
        fontWeight: 'normal', 
        color: 'inherit',
        ...criticalStyle,
    };

    const calculatedStyle = {
        backgroundColor: task.isCritical ? '#FCA5A5' : '#F3F4F6',
        fontStyle: 'italic',
        color: task.isCritical ? '#991B1B' : '#6B7280',
        fontWeight: 'normal',
        ...criticalStyle, 
    };

    // --- Lógica de Columnas Especiales ---

    // Columna 'index' (Número de Tarea)
    if (columnId === 'index') {
        return (
            <div style={{ ...defaultCellStyle, ...calculatedStyle, justifyContent: 'center', paddingLeft: '8px' }}>
                {value}
            </div>
        );
    }
    
    // Columna 'priority' (Selector)
    if (columnId === 'priority') {
        return (
            <select
                value={task.priority}
                onChange={(e) => updateTaskData(task.id, columnId, e.target.value)}
                style={{ 
                    height: '100%', 
                    width: '100%', 
                    padding: '0 8px', 
                    border: 'none', 
                    background: task.isCritical ? '#FEF2F2' : 'white', 
                    cursor: 'pointer', 
                    fontSize: '14px', 
                    ...criticalStyle 
                }}
            >
                {priorityOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        );
    }

    // Columna 'name' (Jerarquía, Colapso, Botones)
    if (columnId === 'name') {
        const isMilestone = task.isMilestone ?? (task.start === task.end && task.progress === 100);
        const isCollapsed = collapsedParents[task.id];
        const depth = getTaskDepth(task, allTasks);

        const nameCellStyle = {
            ...defaultCellStyle,
            paddingLeft: `${depth * 20 + 8}px`, 
            backgroundColor: isCollapsed && !task.isCritical ? '#F3F4F6' : (task.isCritical ? '#FEF2F2' : 'transparent'), 
            cursor: 'default',
            fontWeight: 'normal', 
            color: '#1F2937', 
            justifyContent: 'space-between',
            ...criticalStyle,
        };

        const toggleIcon = isParent ? (
            <span onClick={() => toggleCollapse(task.id)} style={{ paddingRight: '4px', cursor: 'pointer', color: '#4F46E5', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.1s' }}> &#9658; </span>
        ) : (
            <span style={{ paddingRight: '12px', color: '#9CA3AF' }}>&#9679;</span> // Placeholder
        );

        return (
            <div style={nameCellStyle} onDoubleClick={handleDoubleClick}>
                <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
                    {toggleIcon}
                    <div style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMilestone ? <span style={{ marginRight: '5px' }}>💎</span> : ''}
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                onBlur={onBlur}
                                onKeyDown={handleKeyDown}
                                style={{ border: '1px solid #9CA3AF', padding: '2px', width: '90%', outline: 'none' }}
                                type="text"
                            />
                        ) : (
                            value
                        )}
                    </div>
                </div>

                    {/* Botones de + y ◊ */}
                    <div style={{ flexShrink: 0, marginLeft: '10px' }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); addNewTask(task.id); }} 
                            style={{ 
                                padding: '1px 5px', fontSize: '12px', background: '#10B981', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' 
                            }} 
                            title="Agregar Subtarea"
                        > 
                            + 
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); addNewMilestone(task.id); }} 
                            style={{ 
                                padding: '1px 5px', fontSize: '12px', background: '#F59E0B', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' 
                            }} 
                            title="Agregar Sub-Hito"
                        > 
                            ◊ 
                        </button>
                    </div>

            </div>
        );
    }

    // --- Formateo General de Valores ---
    let formattedValue = value;
    if (columnId === 'cost') {
        formattedValue = `$${(parseFloat(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (columnId === 'progress') {
        formattedValue = `${parseInt(value, 10) || 0}%`;
    } else if (isDependencyColumn) {
        // Usa el array simple de IDs (task.dependencies) para la vista
        const depList = Array.isArray(task.dependencies) ? task.dependencies : [];
        const depString = depList.join(', ');
        if (depString) {
            formattedValue = <span style={{ color: '#4F46E5', fontWeight: 'bold' }}>{depString}</span>;
        } else {
            formattedValue = null;
        }
    } else if (columnId === 'totalSlack') {
        const slackValue = task.totalSlack ?? 'N/A';
        let floatColor = slackValue === 0 ? '#DC2626' : (typeof slackValue === 'number' && slackValue > 0 ? '#10B981' : '#6B7280');
        formattedValue = <span style={{ color: floatColor, fontWeight: 'bold' }}>{slackValue === 'N/A' ? slackValue : `${slackValue} días`}</span>;
    }
    
    // Lógica para columna 'totalSlack' (Holgura) - Siempre solo lectura
    if (columnId === 'totalSlack') {
        return (
            <div style={{ ...defaultCellStyle, ...calculatedStyle, justifyContent: 'center' }}>
                {formattedValue}
            </div>
        );
    }

    // Campos calculados de solo lectura (Padres y Rollups)
    if (isCalculatedField) {
        return (
            <div style={{ ...defaultCellStyle, ...calculatedStyle }}>
                {formattedValue || <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />}
            </div>
        );
    }

    // --- Renderizado de Celdas Editables y la Celda de Dependencias ---
    return (
        <div onDoubleClick={handleDoubleClick} style={defaultCellStyle}>
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={onBlur}
                    onKeyDown={handleKeyDown}
                    style={{ border: '1px solid #9CA3AF', padding: '2px', width: '90%', outline: 'none' }}
                    type={columnId === 'cost' || columnId === 'progress' ? 'number' : columnId === 'start' || columnId === 'end' ? 'date' : 'text'}
                />
            ) : (
                // LÓGICA MODIFICADA PARA LA COLUMNA 'dependencies'
                isDependencyColumn ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {/* 1. Valor de las dependencias */}
                        <div 
                            style={{ 
                                flexGrow: 1, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                minWidth: '10px' 
                            }}
                        >
                            {formattedValue || <span style={{ color: '#9CA3AF' }}>Añadir Predecesor</span>}
                        </div>
                        {/* 2. Botón de Gestión */}
                        <button
                          onClick={() => onManageDependencies(task.id)} // ⬅️ ABRE EL MODAL AL HACER CLIC
                            style={{
                                marginLeft: '8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                padding: '2px 6px',
                                backgroundColor: '#4F46E5', 
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                flexShrink: 0
                            }}
                            title="Gestionar Predecesores (Tipo/Lag)"
                        >
                            ⚙️
                        </button>
                    </div>
                ) : (
                    // Lógica original para todas las demás columnas
                    formattedValue || (formattedValue === 0 ? '0' : <span dangerouslySetInnerHTML={{ __html: '&nbsp;' }} />)
                )
            )}
        </div>
    );
});

export default EditableCell;