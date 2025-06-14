import React from 'react';
import { Modal, Button } from 'react-bootstrap';

const PopupMessage: React.FC<{ show: boolean, message: string, handleClose: () => void }> = ({ show, message, handleClose }) => {

    const closeClick = () => {
        handleClose();
    };

    return (
        <Modal show={show} centered backdrop="static" keyboard={false}>
            <Modal.Header>
                <Modal.Title>Alert</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {message}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={closeClick}>
                    OK
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PopupMessage;