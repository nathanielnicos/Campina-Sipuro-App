import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnreadCount, getNotifications, markAsRead, markAllAsRead } from '../../services/notificationApi';
import useOnClickOutside from '../../hooks/useOnClickOutside';
import { createNotificationPoller } from '../../utils/notificationPoller';

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

    // Nilai terbaru yang dibaca poller saat polling; perubahan nilai ini tidak memulai ulang polling.
    const latestRef = useRef({ isOpen, page, onNewPoDetected });
    useEffect(() => {
        latestRef.current = { isOpen, page, onNewPoDetected };
    });

    const pollerRef = useRef(null);
    const listRequestRef = useRef(0);

    useOnClickOutside(dropdownRef, () => {
        if (isOpen) {
            setIsOpen(false);
        }
    });

    // Memuat halaman pertama daftar notifikasi; hanya permintaan terakhir yang dipakai.
    const loadFirstPage = useCallback(async () => {
        const requestId = ++listRequestRef.current;
        const listRes = await getNotifications(userRole, userId, userDepartment, 1, 10);
        if (requestId !== listRequestRef.current) return;
        setNotifications(listRes?.data || []);
        setHasMore(listRes?.pagination?.hasMore || false);
    }, [userRole, userId, userDepartment]);

    useEffect(() => {
        const poller = createNotificationPoller({
            fetchUnreadCount: async () => {
                const countRes = await getUnreadCount(userRole, userId, userDepartment);
                return Number(countRes?.count) || 0;
            },
            fetchLatest: async () => {
                const listRes = await getNotifications(userRole, userId, userDepartment, 1, 10);
                return listRes?.data?.[0];
            },
            refreshOpenList: loadFirstPage,
            onCount: setUnreadCount,
            onNew: (notif) => {
                const handler = latestRef.current.onNewPoDetected;
                if (handler) handler(notif);
            },
            canAnnounce: () => Boolean(latestRef.current.onNewPoDetected),
            isListOpenOnFirstPage: () => latestRef.current.isOpen && latestRef.current.page === 1,
            isHidden: () => document.hidden,
            onError: (error) => console.error('Error polling notification:', error)
        });
        pollerRef.current = poller;
        poller.start();

        const handleVisibilityChange = () => {
            if (!document.hidden) poller.poll();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            poller.stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            pollerRef.current = null;
        };
    }, [userRole, userId, userDepartment, loadFirstPage]);

    // Jumlah yang berubah lokal (ditandai dibaca) diberitahukan ke poller sebagai pembanding berikutnya.
    useEffect(() => {
        if (pollerRef.current) pollerRef.current.setCount(unreadCount);
    }, [unreadCount]);

    const toggleDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            try {
                setPage(1);
                await loadFirstPage();
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
