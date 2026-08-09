CREATE INDEX "boosts_postid_idx" ON "boosts" USING btree ("postid");--> statement-breakpoint
CREATE INDEX "chat_reactions_chatid_idx" ON "chat_reactions" USING btree ("chatid");--> statement-breakpoint
CREATE INDEX "chats_room_idx" ON "chats" USING btree ("serverid","roomid");--> statement-breakpoint
CREATE INDEX "follows_follower_userid_idx" ON "follows" USING btree ("followerUserId");--> statement-breakpoint
CREATE INDEX "likes_postid_idx" ON "likes" USING btree ("postid");--> statement-breakpoint
CREATE INDEX "notifications_userid_idx" ON "notifications" USING btree ("userid");--> statement-breakpoint
CREATE INDEX "posts_room_idx" ON "posts" USING btree ("roomid");--> statement-breakpoint
CREATE INDEX "posts_userid_idx" ON "posts" USING btree ("userid");--> statement-breakpoint
CREATE INDEX "posts_replyto_idx" ON "posts" USING btree ("replyto");--> statement-breakpoint
CREATE INDEX "reactions_postid_idx" ON "reactions" USING btree ("postid");--> statement-breakpoint
CREATE INDEX "wiki_pages_roomid_idx" ON "wiki_pages" USING btree ("roomid");