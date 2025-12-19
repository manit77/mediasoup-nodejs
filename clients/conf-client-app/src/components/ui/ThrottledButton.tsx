import React, { useState, useRef } from 'react';

const ThrottledButton = ({
    onClick,
    cooldownSecs = 1,
    disabled = false,
    children,
    variant = 'secondary',
    className = '',
    ...props
}) => {
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const lastClickTime = useRef(0);

    const handleClick = (event) => {
        // You MUST keep stopPropagation and preventDefault here
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        if (now - lastClickTime.current < (cooldownSecs * 1000)) {
            return false;
        }
        lastClickTime.current = now;

        if (onClick) {
            onClick(event);
        }

        setIsCoolingDown(true);

        setTimeout(() => {
            setIsCoolingDown(false);
        }, cooldownSecs * 1000);
    };

    // Determine the combined disabled state
    const isDisabled = disabled || isCoolingDown;

    // Bootstrap classes to mimic the appearance of a primary button
    const buttonClasses = `btn btn-${variant} ${className} ${isDisabled ? 'disabled' : ''}`;

    return (
        <div
            {...props}
            role="button"
            tabIndex={isDisabled ? -1 : 0}
            aria-disabled={isDisabled}
            className={buttonClasses}
            onClick={isDisabled ? null : handleClick}
            onKeyDown={(e) => {
                if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleClick(e);
                }
            }}
        >
            {children}
        </div>
    );
};

export default ThrottledButton;