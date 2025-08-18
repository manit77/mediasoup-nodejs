import React, { useState, useRef } from 'react';
import { Button } from 'react-bootstrap';

const ThrottledButton = ({    
    onClick,
    cooldownSecs = 1,
    disabled = false,
    children,
    ...props
}) => {
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const lastClickTime = useRef(0);

    const handleClick = (event) => {
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

    return (
        <Button
            {...props}
            disabled={disabled}
            onClick={handleClick}
        >
            {children}
        </Button>
    );
};

export default ThrottledButton;
