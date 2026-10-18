// Tombol bersama dengan tampilan seragam.
// Dipakai pada PODActions dan POPdfModal; tampilannya dijaga sama dengan tombol sebelumnya.

const VARIANTS = {
    primary: { backgroundColor: '#0d6efd', color: '#fff', border: 'none', fontWeight: 'bold' },
    secondary: { backgroundColor: '#6c757d', color: '#fff', border: 'none', fontWeight: 'bold' },
    success: { backgroundColor: '#198754', color: '#fff', border: 'none', fontWeight: 'bold' },
    danger: { backgroundColor: '#dc3545', color: '#fff', border: 'none', fontWeight: 'bold' },
    purple: { backgroundColor: '#6f42c1', color: '#fff', border: 'none', fontWeight: 'bold' },
    outlineSecondary: { backgroundColor: '#ffffff', color: '#6c757d', border: '1px solid #6c757d', fontWeight: 'normal' }
};

const SIZES = {
    md: { padding: '8px 16px' },
    sm: { padding: '6px 14px', fontSize: '13px' }
};

/**
 * @param {'primary'|'secondary'|'success'|'danger'|'purple'|'outlineSecondary'} variant
 * @param {'md'|'sm'} size
 * @param {'button'|'submit'} type  default 'button' agar tidak mengirim form secara tidak sengaja
 */
const Button = ({
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    style = {},
    children,
    ...rest
}) => (
    <button
        type={type}
        disabled={disabled}
        style={{
            ...VARIANTS[variant],
            ...SIZES[size],
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'all 0.2s ease-in-out',
            ...style
        }}
        {...rest}
    >
        {children}
    </button>
);

export default Button;
