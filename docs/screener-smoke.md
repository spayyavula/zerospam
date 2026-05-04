# Screener + Welcome Tour Smoke Checklist

1. Fresh signup, then login.
2. Verify welcome tour appears.
3. Step through all 4 tour steps and click Done.
4. Reload app and verify tour does not appear again.
5. Inject 5 quarantined messages from 3 senders into one mailbox.
6. Open Screener and verify 3 sender rows are shown.
7. Click Yes on sender Sarah and verify the row is removed.
8. Verify Sarah's messages moved to Inbox.
9. Verify domain expand toast appears when sender domain is non-free-mail.
10. Dismiss the toast.
11. Click Yes on a second non-free-mail sender.
12. Click Trust everyone @domain in the toast.
13. Verify all messages from @domain moved to Inbox.
14. Click No on the third sender.
15. Verify row fades/removes and sender messages are in Trash.
16. Open DB and verify a screener_mutes row exists for rejected sender.
17. In Mailbox Manager, set Screener SLA to 1 hour.
18. Adjust message received_at to >1 hour old.
19. Verify sender disappears from Screener but remains in Quarantine.
