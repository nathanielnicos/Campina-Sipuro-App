import { createContext, useContext, useMemo } from 'react';
import { canAccess } from '../utils/permissionHelper';

const PermissionContext = createContext({
    permissions: {},
    can: () => false,
    refresh: () => {}
});

export const PermissionProvider = ({ permissions, refresh, children }) => {
    const value = useMemo(() => ({
        permissions,
        can: (menu, action) => canAccess(permissions, menu, action),
        refresh
    }), [permissions, refresh]);

    return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
};

// { permissions, can(menu, action), refresh() }
export const usePermission = () => useContext(PermissionContext);
