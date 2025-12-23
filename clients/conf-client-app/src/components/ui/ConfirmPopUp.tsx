import { Modal, Button } from 'react-bootstrap';
import PropTypes from 'prop-types';
import styles from './ConfirmPopUp.module.css';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';

const ConfirmPopUp = ({ show, onHide, onConfirm, title, message }) => {
    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            backdrop="static"
            keyboard={false}
            contentClassName={styles.modalContent} // Applies style to the inner modal box
        >
            <Modal.Header className={styles.header} closeVariant="white" closeButton>
                <Modal.Title className={styles.title} id="confirm-modal-title">
                    <ExclamationTriangleFill className="text-warning me-2" size={22} />
                    {title}
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className={styles.body}>
                {message}
            </Modal.Body>

            <Modal.Footer className={styles.footer}>
                <Button className={styles.btnCancel} onClick={onHide}>
                    Cancel
                </Button>
                <Button className={styles.btnConfirm} onClick={onConfirm}>
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
