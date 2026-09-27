SELECT o.order_number, oi.is_customer_design, oi.reference_image_url
FROM "order" o
JOIN orderitem oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 5;
