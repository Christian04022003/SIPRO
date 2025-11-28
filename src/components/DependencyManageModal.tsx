import React, { useState, useMemo, useCallback } from 'react';

// ==========================================================
// ⚠️ FUNCIONES DE UTILIDAD NECESARIAS (Deben estar aquí o importadas)
// Asumimos que su lógica es la que definiste previamente:
// ==========================================================

// Convierte la cadena de dependencias (ej: T1[FS+0], T2[SS+5]) a un Array de objetos
export const parseDependencies = (depString) => {
    if (!depString) return [];
    
    // El Regex busca: ID de Tarea (\w+), Tipo [FS|SS|FF|SF], y Lag opcional ([\+\-]\d+)?
    const dependencyRegex = /(\w+)\[(FS|SS|FF|SF)([\+\-]\d+)?\]/g;
    const dependencies = [];
    let match;

    while ((match = dependencyRegex.exec(depString)) !== null) {
        dependencies.push({
            taskId: match[1],
            type: match[2],
            lag: parseInt(match[3] || '0') 
        });
    }
    
    return dependencies;
};

// Convierte el Array de objetos de vuelta a la cadena de texto para guardar
export const formatDependencies = (deps) => {
    return deps.map(d => {
        // Asegura que el lag tenga el signo '+' si es positivo o cero para mantener el formato.
        const lagString = d.lag >= 0 ? `+${d.lag}` : d.lag.toString();
        return `${d.taskId}[${d.type}${lagString}]`;
    }).join(', ');
};

// ==========================================================
// 💡 COMPONENTE PRINCIPAL
// ==========================================================

export const DependencyManagerModal = ({ taskId, onClose, allTasks, updateTaskData }) => {
    // 1. Encuentra la tarea que se está editando
    const task = allTasks.find(t => t.id === taskId);
    
    // 2. Estado interno para las dependencias (parseadas del string de la tarea)
    const [dependencies, setDependencies] = useState(parseDependencies(task?.dependencies || ''));
    
    // ⚠️ La línea 'const [details, setDetails] = useState(...)' fue eliminada ya que era redundante.
    
    const [newPredecessorId, setNewPredecessorId] = useState('');

    // 3. Calcula la lista de predecesores disponibles (useMemo optimizado)
    const availablePredecessors = useMemo(() => {
        const existingDepIds = new Set(dependencies.map(d => d.taskId));
        // Filtra todas las tareas que no son la actual y que aún no son dependencias
        return allTasks.filter(t => t.id !== taskId && !existingDepIds.has(t.id)); 
    }, [allTasks, taskId, dependencies]);
    
    // Opciones de tipo de dependencia (Finish-to-Start, Start-to-Start, etc.)
    const dependencyOptions = ['FS', 'SS', 'FF', 'SF']; 


    // --- HANDLERS ---
//  const getSimpleDependencyIds = (depDetailsString) => {
//         // Usa el parser complejo y solo extrae el taskId
//         return parseDependencies(depDetailsString).map(dep => dep.taskId);
//     };

    const handleAddDependency = useCallback(() => {
        if (!newPredecessorId) return;

        setDependencies(prev => [
            ...prev, 
            { taskId: newPredecessorId, type: 'FS', lag: 0 } // Se añade por defecto como FS+0
        ]);
        setNewPredecessorId('');
    }, [newPredecessorId]);

    const handleUpdateDependency = useCallback((index, field, value) => {
        setDependencies(prev => prev.map((dep, i) => {
            if (i === index) {
                // Asegura que el 'lag' sea un número entero
                const newValue = field === 'lag' ? parseInt(value) || 0 : value;
                return { ...dep, [field]: newValue };
            }
            return dep;
        }));
    }, []);

    const handleDeleteDependency = useCallback((index) => {
        setDependencies(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleSaveAndClose = useCallback(() => {
        // Convierte el array de dependencias de vuelta a la cadena de texto
        const newDepString = formatDependencies(dependencies);
        
        // Llama a la función del padre para actualizar la tarea
        updateTaskData(taskId, 'dependencies', newDepString);
        
        onClose();
    }, [dependencies, taskId, updateTaskData, onClose]);


    if (!task) return null; // No renderizar si la tarea no existe

    // --- RENDERIZADO JSX (La interfaz visual del modal) ---
    return (
        // Overlay de fondo (para que el modal esté en el centro y el fondo sea oscuro)
        <div style={{
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
            zIndex: 1000, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center'
        }}>
            {/* Contenido del Modal */}
            <div style={{ 
                backgroundColor: 'white', 
                padding: '25px', 
                border: '2px solid #4F46E5',
                boxShadow: '0 8px 20px rgba(0,0,0,0.4)', 
                zIndex: 1001,
                width: '500px',
                maxWidth: '90vw',
                borderRadius: '8px'
            }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#4F46E5' }}>🔗 Gestionar Dependencias</h3>
                <p style={{ margin: '0 0 20px 0', borderBottom: '1px solid #E5E7EB', paddingBottom: '10px' }}>
                    Editando predecesores para: <strong style={{ color: '#F59E0B' }}>{task.name} ({taskId})</strong>
                </p>

                {/* --- AÑADIR NUEVO PREDECESOR --- */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
                    <select
                        value={newPredecessorId}
                        onChange={(e) => setNewPredecessorId(e.target.value)}
                        style={{ flexGrow: 1, padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                    >
                        <option value="" disabled>Seleccionar Tarea...</option>
                        {availablePredecessors.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name} ({t.id})
                            </option>
                        ))}
                    </select>
                    <button 
                        onClick={handleAddDependency} 
                        disabled={!newPredecessorId}
                        style={{ padding: '8px 15px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Añadir
                    </button>
                </div>

                {/* --- LISTA DE DEPENDENCIAS EXISTENTES --- */}
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F3F4F6' }}>
                                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #D1D5DB' }}>Predecesor</th>
                                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #D1D5DB', width: '120px' }}>Tipo</th>
                                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #D1D5DB', width: '80px' }}>Lag</th>
                                <th style={{ padding: '8px', width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {dependencies.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '15px', textAlign: 'center', color: '#6B7280' }}>
                                        Esta tarea no tiene predecesores.
                                    </td>
                                </tr>
                            ) : (
                                dependencies.map((dep, index) => {
                                    const predTask = allTasks.find(t => t.id === dep.taskId);
                                    return (
                                        <tr key={dep.taskId} style={{ borderBottom: '1px solid #E5E7EB' }}>
                                            <td style={{ padding: '8px', color: '#4F46E5', fontWeight: 'bold' }}>
                                                {predTask ? `${predTask.name} (${dep.taskId})` : `ID no encontrado (${dep.taskId})`}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <select
                                                    value={dep.type}
                                                    onChange={(e) => handleUpdateDependency(index, 'type', e.target.value)}
                                                    style={{ padding: '4px', border: '1px solid #D1D5DB', borderRadius: '3px' }}
                                                >
                                                    {dependencyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={dep.lag}
                                                    onChange={(e) => handleUpdateDependency(index, 'lag', e.target.value)}
                                                    style={{ width: '50px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '3px', textAlign: 'center' }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleDeleteDependency(index)}
                                                    style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontSize: '18px' }}
                                                >
                                                    &times;
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- BOTONES DE ACCIÓN --- */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '25px' }}>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            padding: '10px 20px', 
                            backgroundColor: '#6B7280', 
                            color: 'white',
                            border: 'none', 
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveAndClose} 
                        style={{ 
                            padding: '10px 20px', 
                            backgroundColor: '#4F46E5', 
                            color: 'white',
                            border: 'none', 
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DependencyManagerModal;