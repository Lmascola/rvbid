# RV Bid Fast

These prompts listed 1-4 are prompts given to you previously in building this site follow the prompts understand them do all the work flow step by step from 1-4 they may be updates in between but move according to order and deliver as the site should be 

 

1.RV AUCTION PLATFORM MASTER PROMPT COLLECTION

NOTE: This text file contains the consolidated prompt sections created

during our discussions. Because the complete specification exceeds what

can fit in a single ChatGPT response, this file serves as the starting

master prompt.

================================================== CORE PLATFORM

==================================================

Build a premium RV auction marketplace focused on USED RVs only.

Main concept: - 12-hour “Fast Fingers” auctions. - User accounts. -

Wallet funding. - Crypto deposit workflow. - Admin approval tools. -

Professional UI. - Mobile responsive.

================================================== HOMEPAGE

==================================================

Always display: - Exactly 10 Live Auctions. - Exactly 10 Recently Sold

Auctions.

Listings must be editable from the Admin Dashboard.

Initial statistics: - Live Auctions: 10 - Completed Auctions: 92 - RVs

Sold: 92

Statistics become dynamic after launch and remain editable by admins.

================================================== AUTOMATIC AUCTION

LOGIC ==================================================

When an auction ends: - Close bidding. - Record the winner. - Move

listing to Recently Sold. - Remove from Live Auctions. - Increment

Completed Auctions. - Increment RVs Sold. - Automatically pull in the

next live listing.

Each live auction has a real-time countdown timer.

================================================== REGISTRATION

==================================================

Step 1: Collect: - Name - DOB - Email - Phone - State - ZIP - Password

Step 2: Require: - Government ID upload - Selfie upload

Account remains Pending until admin approval.

================================================== USER DASHBOARD

==================================================

After approval unlock: - Wallet - Deposits - Withdrawals - Bids - Won

Auctions - Lost Auctions - Transactions - Settings - Profile

================================================== ADMIN

==================================================

Admin can: - Manage users - Manage balances - Approve KYC - Manage

auctions - Upload/edit RVs - Edit homepage stats - Assign deposit

addresses and QR codes - Manage legal pages - Manage FAQ - Manage

contact email

================================================== FIXES

==================================================

Fix: - Sign up - Sign in - Keyboard issues - Mobile scrolling - Broken

navigation - Duplicate auction pages - Upcoming auctions removal -

Responsive layout - Refresh loops

================================================== LEGAL

==================================================

Generate: - Terms of Service - Privacy Policy - Wallet Policy - Refund

Policy - Auction Rules - Identity Verification Policy - FAQ

Tailor them specifically to this platform

2. A few things to change and Correct 8. RV Condition and As-Is Sales

8.All RVs are sold used and as-is without warranty, express or implied. We provide descriptions and photos in good faith, but we encourage you to inspect vehicles or request additional information before bidding. The platform is not responsible for mechanical issues discovered after purchase.

this remove , but we encourage you to inspect vehicles or request additional information before bidding. The platform is not responsible for mechanical issues discovered after purchase. And add we would help assist with any issue arise  then I’ll like to include that bidders can choose to stay anonymous to other bidders despite the kyc and then this part of wallet policy When you win an auction, the winning bid is deducted from your balance.

* If your balance is insufficient at auction close, the win may be voided and the next-highest bidder considered.

5. Withdrawals You may request a withdrawal of your wallet balance through your Dashboard. Withdrawals are processed by the admin team to your original deposit method or a verified address. Withdrawal requests are subject to review and may take several business days. No user would be able to place a bid that doesn’t have the amount in his wallet bids are the amount in your wallet example if you deposit 599  you can only bid 599 and below and when you bid the portion of that amount or all is locked in that bid till it expires or gets outbid then withdrawals are processed immediately but may take 1-2 hours depending on crypto network used for transactions then refunds policy approved refunds should be processed immediately since it’s crypto transactions once it’s verified for cause 3. Failed Payment Due to Insufficient Balance If you win an auction but your wallet balance is insufficient at close, the win is voided. No charge is applied to your account. The auction may be re-awarded to the next-highest bidder. This should be removed entirely as you won’t be able to place a bid on an auction if you don’t have that particular amount of the bid amount at the time to be locked Mechanical issues discovered after purchase and inspection are not refundable, as all RVs are sold as-is. Make this change to that line . and then also let’s add vin numbers to the templates as well and then the bidder that won the previous Auctions could also show some user names or some anonymous X652 for example for users that chose to remain anonymous to other bidders then  also make this change were changing the name to rvbid so the support would change to support.rvbid.com then add the completed auctions and rv sold to 118 , then i need to know how to use the back end how to log into the back end to update changes

3. Admin should be able to set current amount of bids and current bid amount also but each bid set by admin should list a generated user that would carry the anonymous user tag with the set bid amount only if admin sets this function but other users bid should appear as they set with the appropriate bid amount they used from their wallet then the photos of the rvs the admin can upload more than 1 for users to see up to 40 if desired for new users who haven’t registered they won’t be able to see the complete vin number just until after sign up and verification only logged in verified users can see complete vin also the bids starts from 0$ and that’s the catch so people get amazing deals so previous sales should be cheaper than market values but admin would be able to edit that so you can skip but also history of bids as well should be on listings so users and new users can see where the bidding amount started from and the users that bid either anonymous or not

4. The sold rvs the bids should also show there like how many bids was made ransom numbers for the sold ones along with users that bid if I can already do this on the back end with the admin ignore the prompt then The header there’s nothing there at the top of the page it should read rvbid bold logo

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/743fb496-3fec-46c0-ba28-6536012a3e95).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
