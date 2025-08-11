import React, { useState, useRef } from 'react';
import { Button } from 'react-bootstrap';

const ThrottledButton = ({    
    onClick,
    cooldownSecs = 3,
    disabled = false,
    children,
    ...props
}) => {
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const lastClickTime = useRef(0);

    const handleClick = (e) => {
        const now = Date.now();
        if (now - lastClickTime.current < (cooldownSecs * 1000)) {
            return; // Ignore fast click
        }
        lastClickTime.current = now;

        if (onClick) onClick(e);

        setIsCoolingDown(true);
        setTimeout(() => {
            setIsCoolingDown(false);
        }, cooldownSecs * 1000);
    };

    return (
        <Button
            {...props}
            disabled={disabled || isCoolingDown}
            onClick={handleClick}
        >
            {children}
        </Button>
    );
};

export default ThrottledButton;
