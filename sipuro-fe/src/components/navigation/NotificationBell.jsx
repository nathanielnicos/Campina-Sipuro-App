import { useNotifications } from '../../hooks/notification/useNotifications';
import { formatDateTime } from '../../utils/dateHelper';

const NotificationBell = ({ onNewPoDetected, user, setShowBanner }) => {
    const {
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
    } = useNotifications({ user, onNewPoDetected, setShowBanner });

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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#3b82f6',
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        padding: 0
                                    }}
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                No notifications available.
                            </div>
                        ) : (
                            <>
                                {notifications.map((item) => {
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
                                })}

                                {hasMore && (
                                    <div style={{ padding: '10px', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                                        <button
                                            type="button"
                                            onClick={handleLoadMore}
                                            disabled={loadingMore}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#3b82f6',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: loadingMore ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            {loadingMore ? 'Loading...' : 'Load More (+10)'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
