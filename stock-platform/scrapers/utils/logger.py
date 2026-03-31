import logging

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    log = logging.getLogger(name)
    if not log.handlers:
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s', '%H:%M:%S'))
        log.addHandler(h)
    log.setLevel(getattr(logging, level.upper(), logging.INFO))
    return log
