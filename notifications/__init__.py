#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Package notifications - Hệ thống thông báo cho MikroTik Monitor
"""

from notifications.notification_service import notification_service, send_alert

__all__ = ['notification_service', 'send_alert']