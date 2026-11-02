import { ACTION_LABELS, ACTION_ORDER } from './permissionLabels';

const th = { padding: '10px', textAlign: 'center', fontSize: '12px' };

// Satu kelompok: baris = menu, kolom = aksi. Sel tanpa aksi yang berlaku diberi tanda "-".
const PermissionMatrix = ({ group, menus, isChecked, isChanged, isLocked, onToggle, disabled }) => (
    <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ ...th, textAlign: 'left' }}>Menu</th>
                    {ACTION_ORDER.map((action) => (
                        <th key={action} style={th}>{ACTION_LABELS[action]}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {menus.map((menu) => {
                    const locked = isLocked(group, menu.code);
                    return (
                        <tr key={menu.code} style={{ borderBottom: '1px solid #e9ecef' }}>
                            <td style={{ padding: '10px', fontWeight: 'bold' }}>
                                {menu.label}
                                {locked && (
                                    <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 'normal', color: '#6c757d' }}>
                                        (always allowed)
                                    </span>
                                )}
                            </td>
                            {ACTION_ORDER.map((action) => {
                                if (!menu.actions.includes(action)) {
                                    return <td key={action} style={{ ...th, color: '#adb5bd' }}>-</td>;
                                }
                                const changed = isChanged(group, menu.code, action);
                                return (
                                    <td key={action} style={{ ...th, backgroundColor: changed ? '#fff3cd' : 'transparent' }}>
                                        <input
                                            type="checkbox"
                                            aria-label={`${menu.label} ${ACTION_LABELS[action]}`}
                                            checked={isChecked(group, menu.code, action)}
                                            disabled={locked || disabled}
                                            title={locked ? 'Superadmin access to this menu cannot be removed.' : undefined}
                                            onChange={() => onToggle(group, menu.code, action)}
                                            style={{ width: '16px', height: '16px', cursor: locked || disabled ? 'not-allowed' : 'pointer' }}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

export default PermissionMatrix;
