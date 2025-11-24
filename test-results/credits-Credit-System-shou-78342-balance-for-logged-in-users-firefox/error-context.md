# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=e4]:
    - generic [ref=e5]:
      - img [ref=e8]
      - generic [ref=e12]: Welcome Back
      - generic [ref=e13]: Sign in to your CodedSwitch account
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]:
          - text: Email
          - textbox "Email" [ref=e17]:
            - /placeholder: you@example.com
        - generic [ref=e18]:
          - text: Password
          - textbox "Password" [ref=e19]:
            - /placeholder: ••••••••
      - generic [ref=e20]:
        - button "Sign In" [ref=e21] [cursor=pointer]
        - generic [ref=e22]:
          - text: Don't have an account?
          - link "Sign up" [ref=e23] [cursor=pointer]:
            - /url: /signup
```