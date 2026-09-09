import { useState, useEffect, useRef } from 'react';
import { getUnreadCount, getNotifications, markAllAsRead } from '../../services/notificationApi';
import { ROLE_PERMISSIONS } from '../../config/navigationConfig';
import { formatDateTime } from '../../utils/formatters';

const NotificationBell = ({ onNewPoDetected, user, setActiveTab, setShowPoBanner }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const dropdownRef = useRef(null);

    const userRole = user?.role;
    const userId = user?.customer_id || user?.id || user?.code;
    const userDepartment = user?.department || user?.role;

    useEffect(() => {
        const fetchNotificationData = async () => {
            if (document.hidden) return;

            try {
                const countRes = await getUnreadCount(userRole, userId, userDepartment);
                const currentCount = countRes?.count || 0;

                if (currentCount > unreadCount && onNewPoDetected) {
                    const listRes = await getNotifications(userRole, userId, userDepartment);
                    const latestNotif = listRes?.data?.[0];
                    onNewPoDetected(latestNotif?.message || 'There is a new PO update available.');
                }

                setUnreadCount(currentCount);

                if (isOpen) {
                    const listRes = await getNotifications(userRole, userId, userDepartment);
                    setNotifications(listRes?.data || []);
                }
            } catch (error) {
                console.error('Error polling notification:', error);
            }
        };

        fetchNotificationData();
        const interval = setInterval(fetchNotificationData, 60000);

        const handleVisibilityChange = () => {
            if (!document.hidden) fetchNotificationData();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isOpen, unreadCount, onNewPoDetected, userRole, userId, userDepartment]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            try {
                const listRes = await getNotifications(userRole, userId, userDepartment);
                setNotifications(listRes?.data || []);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleItemClick = async (item) => {
        // 1. Hilangkan banner secara otomatis saat notifikasi diklik
        if (setShowPoBanner) {
            setShowPoBanner(false);
        }

        // 2. Update status lokal UI agar instan
        setUnreadCount(0);
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
        );

        // 3. Panggil API markAllAsRead di backend
        try {
            await markAllAsRead(userRole, userId, userDepartment);
        } catch (err) {
            console.error('Failed to mark all as read from backend:', err);
        }

        // 4. Navigasi ke tab target
        let targetTab = null;

        if (item.link) {
            const cleanedLink = item.link.replace(/^\//, '');
            if (cleanedLink) targetTab = cleanedLink;
        }

        if (!targetTab) {
            const roleMenus = ROLE_PERMISSIONS[userRole] || [];
            if (roleMenus.length > 0) {
                targetTab = roleMenus[0].id;
            }
        }

        if (targetTab && setActiveTab) {
            setActiveTab(targetTab);
        }

        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                onClick={toggleDropdown}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '6px',
                    fontSize: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'background-color 0.2s'
                }}
            >
                🔔
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '0px',
                        right: '-2px',
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '2px 5px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        lineHeight: 1,
                        boxShadow: '0 0 0 2px #1e293b'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '42px',
                    width: '360px',
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: '#0f172a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                            <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px' }}>
                                {unreadCount} new
                            </span>
                        )}
                    </div>

                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                No notifications available.
                            </div>
                        ) : (
                            notifications.map((item) => {
                                const isHovered = hoveredId === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleItemClick(item)}
                                        onMouseEnter={() => setHoveredId(item.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            padding: '12px 16px',
                                            borderBottom: '1px solid #f8fafc',
                                            backgroundColor: isHovered
                                                ? '#f1f5f9'
                                                : item.is_read ? '#ffffff' : '#f8fafc',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.15s ease',
                                            display: 'flex',
                                            gap: '10px',
                                            alignItems: 'flex-start'
                                        }}
                                    >
                                        <div style={{ width: '8px', paddingTop: '4px' }}>
                                            {!item.is_read && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: '7px',
                                                    height: '7px',
                                                    backgroundColor: '#3b82f6',
                                                    borderRadius: '50%'
                                                }} />
                                            )}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'baseline',
                                                marginBottom: '2px'
                                            }}>
                                                <span style={{
                                                    fontWeight: item.is_read ? '600' : '700',
                                                    color: '#1e293b',
                                                    fontSize: '13px'
                                                }}>
                                                    {item.title}
                                                </span>
                                                <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                                    {formatDateTime(item.created_at)}
                                                </span>
                                            </div>

                                            <div style={{ color: '#64748b', fontSize: '12px', lineHeight: '1.4' }}>
                                                {item.message}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
