import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '../../services/notificationApi';
import useOnClickOutside from '../../hooks/useOnClickOutside';

export const useNotifications = ({ user, onNewPoDetected, setShowBanner }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredId, setHoveredId] = useState(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const userRole = user?.role;
    const userId = user?.id;
    const userDepartment = user?.department;

    useOnClickOutside(dropdownRef, () => {
        if (isOpen) {
            setIsOpen(false);
        }
    });

    useEffect(() => {
        const fetchNotificationData = async () => {
            if (document.hidden) return;

            try {
                const countRes = await getUnreadCount(userRole, userId, userDepartment);
                const currentCount = countRes?.count || 0;

                if (currentCount > unreadCount && onNewPoDetected) {
                    const listRes = await getNotifications(userRole, userId, userDepartment, 1, 10);
                    const latestNotif = listRes?.data?.[0];
                    onNewPoDetected(latestNotif);
                }

                setUnreadCount(currentCount);

                if (isOpen && page === 1) {
                    const listRes = await getNotifications(userRole, userId, userDepartment, 1, 10);
                    setNotifications(listRes?.data || []);
                    setHasMore(listRes?.pagination?.hasMore || false);
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
    }, [isOpen, page, unreadCount, onNewPoDetected, userRole, userId, userDepartment]);

    const toggleDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            try {
                setPage(1);
                const listRes = await getNotifications(userRole, userId, userDepartment, 1, 10);
                setNotifications(listRes?.data || []);
                setHasMore(listRes?.pagination?.hasMore || false);
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        try {
            const listRes = await getNotifications(userRole, userId, userDepartment, nextPage, 10);
            const newItems = listRes?.data || [];
            setNotifications((prev) => [...prev, ...newItems]);
            setPage(nextPage);
            setHasMore(listRes?.pagination?.hasMore || false);
        } catch (err) {
            console.error('Failed to load more notifications:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleItemClick = async (item) => {
        if (setShowBanner) setShowBanner(false);

        if (!item.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setNotifications((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
            );
            try {
                await markAsRead(item.id);
            } catch (err) {
                console.error('Failed to mark item as read:', err);
            }
        }

        if (item.link) {
            const urlParts = item.link.split('?');
            const pathPart = urlParts[0].startsWith('/') ? urlParts[0] : `/${urlParts[0]}`;
            const queryString = urlParts[1] ? `?${urlParts[1]}` : '';

            navigate(`${pathPart}${queryString}`);
        }

        setIsOpen(false);
    };

    const handleMarkAllAsRead = async () => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

        try {
            await markAllAsRead(userRole, userId, userDepartment);
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    return {
        unreadCount,
        notifications,
        isOpen,
        hoveredId,
        hasMore,
        loadingMore,
        setHoveredId,
        dropdownRef,
        toggleDropdown,
        handleItemClick,
        handleLoadMore,
        handleMarkAllAsRead
    };
};
