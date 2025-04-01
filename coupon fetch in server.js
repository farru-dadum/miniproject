app.get("/get-user-score/:username", async (req, res) => {
  const { username } = req.params;
  console.log(`🔍 Fetching score for username: ${username}`);

  try {
      const { data: reward, error: rewardError } = await supabase.from("reward").select("score, redeemed_points").ilike("username", username).single();

      if (rewardError || !reward) {
          return res.status(404).json({ error: "User not found or no rewards available" });
      }

      const userPoints = reward.score;
      const redeemedPoints = reward.redeemed_points;

      if (redeemedPoints >= userPoints) {
          return res.json({ score: userPoints, message: "Coupon already redeemed for this score." });
      }

      const category = getCategory(userPoints);
      if (!category) {
          return res.json({ score: userPoints, couponImage: null });
      }

      const { data: coupons, error: couponError } = await supabase.from("coupons").select("image_url").ilike("category", category);

      if (couponError) {
          return res.status(500).json({ error: "Error fetching coupons" });
      }

      let couponImage = "";
      if (coupons && coupons.length > 0) {
          couponImage = coupons[Math.floor(Math.random() * coupons.length)].image_url;
          await supabase.from("reward").update({ redeemed_points: userPoints }).ilike("username", username);
      } else {
          return res.json({ score: userPoints, message: "No coupons available for your category." });
      }

      res.json({ score: userPoints, couponImage });

  } catch (error) {
      res.status(500).json({ error: "Internal server error" });
  }
});
