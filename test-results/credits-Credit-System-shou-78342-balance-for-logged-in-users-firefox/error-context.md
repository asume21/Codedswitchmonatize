# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=e3]:
    - button "CS CodedSwitch" [ref=e4] [cursor=pointer]:
      - generic [ref=e6]: CS
      - generic [ref=e7]: CodedSwitch
      - img [ref=e8]
    - button "Sign In" [ref=e10] [cursor=pointer]:
      - img
      - text: Sign In
  - generic [ref=e12]:
    - generic [ref=e13]:
      - img [ref=e16]
      - generic [ref=e20]: Welcome Back
      - generic [ref=e21]: Sign in to your CodedSwitch account
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - text: Email
          - textbox "Email" [ref=e25]:
            - /placeholder: you@example.com
        - generic [ref=e26]:
          - text: Password
          - textbox "Password" [ref=e27]:
            - /placeholder: ••••••••
      - generic [ref=e28]:
        - button "Sign In" [ref=e29] [cursor=pointer]
        - generic [ref=e30]:
          - text: Don't have an account?
          - link "Sign up" [ref=e31] [cursor=pointer]:
            - /url: /signup
```