import { useState, useEffect, useRef } from 'react';
import { getUnreadCount, getNotifications, markAllAsRead } from '../../services/notificationApi';
import { ROLE_PERMISSIONS } from '../../config/navigationConfig';

export const useNotifications = ({ user, onNewPoDetected, setActiveTab, setShowPoBanner }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const dropdownRef = useRef(null);

    const userRole = user?.role;
    const userId = user?.customer_id || user?.id || user?.code;
    const userDepartment = user?.department || user?.role;

    // Polling & Visibility Listener
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

    // Click Outside Listener
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Toggle Dropdown Menu
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

    // Handle Click Notification Item
    const handleItemClick = async (item) => {
        if (setShowPoBanner) {
            setShowPoBanner(false);
        }

        setUnreadCount(0);
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
        );

        try {
            await markAllAsRead(userRole, userId, userDepartment);
        } catch (err) {
            console.error('Failed to mark all as read from backend:', err);
        }

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

    return {
        unreadCount,
        notifications,
        isOpen,
        hoveredId,
        setHoveredId,
        dropdownRef,
        toggleDropdown,
        handleItemClick
    };
};
