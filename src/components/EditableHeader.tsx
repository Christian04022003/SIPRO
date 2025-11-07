// src/components/EditableHeader.tsx

import React, { useState, useRef, useEffect } from 'react';
import { ColumnDef } from '../types';

interface EditableHeaderProps {
    column: ColumnDef;
    updateColumnHeader: (columnId: string, newHeader: string) => void;
    columnWidths: Record<string, number>;
}

const EditableHeader: React.FC<EditableHeaderProps> = ({ column, updateColumnHeader, columnWidths }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [headerValue, setHeaderValue] = useState(column.header);
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Sincronizar el valor si el nombre se actualiza externamente (ej: al crearse)
    useEffect(() => {
        setHeaderValue(column.header);
    }, [column.header]);

    // IDs de columnas que NO deben ser editables (estándar del sistema)
    const nonEditableIds = [
        'id', 'name', 'start', 'end', 'progress', 'parentId', 'cost', 'priority', 'dependencies', 
        'duration', 'ES', 'EF', 'LS', 'LF', 'Float', 'successors', 'isCritical', 'index'
    ];

    const handleDoubleClick = () => {
        // Bloquear edición si es una columna estándar
        if (nonEditableIds.includes(column.id)) {
             return;
        }

        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleBlur = () => {
        setIsEditing(false);
        const trimmedValue = headerValue.trim();
        
        if (trimmedValue && trimmedValue !== column.header) {
            updateColumnHeader(column.id, trimmedValue);
        } else {
            setHeaderValue(column.header);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setHeaderValue(column.header);
            setIsEditing(false);
        }
    };

    // Estilos para la celda de encabezado
    const tableHeaderCellStyle: React.CSSProperties = {
        width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : 'auto',
        minWidth: columnWidths[column.id] ? `${columnWidths[column.id]}px` : 'auto',
        position: 'sticky', 
        top: 0, 
        padding: '8px', 
        textAlign: 'left', 
        borderRight: '1px solid #E5E7EB',
        fontSize: '14px',
        color: '#374151',
        fontWeight: 'bold',
        cursor: nonEditableIds.includes(column.id) ? 'default' : 'pointer'
    };

    return (
        <th 
            style={tableHeaderCellStyle}
            onDoubleClick={handleDoubleClick}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    value={headerValue}
                    onChange={e => setHeaderValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{ border: '1px solid #9CA3AF', padding: '2px', width: '90%', outline: 'none' }}
                />
            ) : (
                column.header
            )}
        </th>
    );
};

export default EditableHeader;