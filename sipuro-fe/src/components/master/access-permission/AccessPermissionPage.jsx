import { useState } from 'react';
import { useAccessPermissions } from '../../../hooks/master/useAccessPermissions';
import PermissionMatrix from './PermissionMatrix';
import PermissionHistory from './PermissionHistory';
import { GROUP_LABELS } from './permissionLabels';

const tabStyle = (active, disabled) => ({
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid #dee2e6',
    borderBottom: active ? '3px solid #0d6efd' : '1px solid #dee2e6',
    backgroundColor: active ? '#fff' : '#f8f9fa',
    color: active ? '#0d6efd' : '#495057',
    borderRadius: '4px 4px 0 0',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1
});

const AccessPermissionPage = () => {
    const [tab, setTab] = useState('permissions');
    const {
        view, loading, saving, activeGroup, setActiveGroup, pendingCount, pendingByGroup, historyVersion,
        isChecked, isChanged, isLocked, handleToggle, handleDiscard, handleSave
    } = useAccessPermissions();

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '12px 16px 0 16px',
                borderRadius: '8px 8px 0 0',
                border: '1px solid #dee2e6',
                borderBottom: 'none',
                display: 'flex',
                gap: '8px'
            }}>
                <button type="button" onClick={() => setTab('permissions')} style={tabStyle(tab === 'permissions', false)}>
                    Permissions
                </button>
                <button type="button" onClick={() => setTab('history')} style={tabStyle(tab === 'history', false)}>
                    History
                </button>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '0 0 8px 8px', border: '1px solid #dee2e6' }}>
                {loading || !view ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#6c757d' }}>
                        Loading access permissions...
                    </div>
                ) : tab === 'history' ? (
                    <PermissionHistory menus={view.menus} reloadKey={historyVersion} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                            Choose what each user group can see and do. The server applies a saved change within a few seconds;
                            menus and buttons of signed-in users update when they reload the page or sign in again.
                        </div>

                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {view.groups.map((group) => (
                                <button
                                    key={group}
                                    type="button"
                                    onClick={() => setActiveGroup(group)}
                                    style={{
                                        padding: '6px 14px',
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        border: '1px solid #0d6efd',
                                        backgroundColor: activeGroup === group ? '#0d6efd' : '#fff',
                                        color: activeGroup === group ? '#fff' : '#0d6efd'
                                    }}
                                >
                                    {GROUP_LABELS[group] || group}
                                    {pendingByGroup[group] ? ` (${pendingByGroup[group]})` : ''}
                                </button>
                            ))}
                        </div>

                        <PermissionMatrix
                            group={activeGroup}
                            menus={view.menus}
                            isChecked={isChecked}
                            isChanged={isChanged}
                            isLocked={isLocked}
                            onToggle={handleToggle}
                            disabled={saving}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                {pendingCount > 0 ? `${pendingCount} unsaved change(s)` : 'No unsaved changes'}
                            </span>
                            <button
                                type="button"
                                onClick={handleDiscard}
                                disabled={pendingCount === 0 || saving}
                                style={{
                                    padding: '8px 14px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ced4da',
                                    backgroundColor: '#fff', cursor: pendingCount === 0 || saving ? 'not-allowed' : 'pointer',
                                    opacity: pendingCount === 0 || saving ? 0.6 : 1
                                }}
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={pendingCount === 0 || saving}
                                style={{
                                    padding: '8px 18px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', border: 'none',
                                    backgroundColor: '#0d6efd', color: '#fff', cursor: pendingCount === 0 || saving ? 'not-allowed' : 'pointer',
                                    opacity: pendingCount === 0 || saving ? 0.6 : 1
                                }}
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccessPermissionPage;
