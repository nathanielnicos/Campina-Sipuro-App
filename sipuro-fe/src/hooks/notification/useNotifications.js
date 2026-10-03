import { useState, useEffect, useRef } from 'react';
import { getUnreadCount, getNotifications, markAllAsRead } from '../../services/notificationApi';
import { getNavItemsByUser } from '../../config/navigationConfig';
import useOnClickOutside from '../../hooks/useOnClickOutside';

export const useNotifications = ({ user, onNewPoDetected, setActiveTab, setShowBanner }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);
    const dropdownRef = useRef(null);

    const userRole = user?.role;
    const userId = user?.id;
    const userDepartment = user?.department;

    // Click Outside Listener menggunakan custom hook useOnClickOutside
    useOnClickOutside(dropdownRef, () => {
        if (isOpen) {
            setIsOpen(false);
        }
    });

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
                    onNewPoDetected({
                        message: latestNotif?.message || 'There is a new update available.',
                        link: latestNotif?.link || null
                    });
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
        if (setShowBanner) {
            setShowBanner(false);
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
            const roleMenus = getNavItemsByUser(user);
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
