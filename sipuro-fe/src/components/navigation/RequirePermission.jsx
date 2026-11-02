import { Navigate } from 'react-router-dom';
import { usePermission } from '../../context/PermissionContext';

// Membuka halaman hanya bila pengguna punya izin "read" pada menunya; selain itu diarahkan ke halaman awal.
const RequirePermission = ({ menu, redirectTo, children }) => {
    const { can } = usePermission();
    return can(menu, 'read') ? children : <Navigate to={redirectTo} replace />;
};

export default RequirePermission;
