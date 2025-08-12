import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

const ConfirmPopUp = ({ show, onHide, onConfirm, title, message }) => {
    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop="static"
            keyboard={false}
            aria-labelledby="confirm-modal-title"
        >
            <Modal.Header closeButton>
                <Modal.Title id="confirm-modal-title">{title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>{message}</Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button variant="danger" onClick={onConfirm}>
                    Confirm
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

ConfirmPopUp.propTypes = {
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string,
    message: PropTypes.string,
};

ConfirmPopUp.defaultProps = {
    title: 'Confirm Action',
    message: 'Are you sure you want to perform this action?',
};

export default ConfirmPopUp;
